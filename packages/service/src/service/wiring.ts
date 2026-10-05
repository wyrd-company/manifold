// ---
// relationships:
//   implements: service-assembly
// ---
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import { serviceImplementations } from "../implementations.ts";
import { stderrLog } from "./log.ts";
import type {
  ServiceAssembly,
  ServiceWiringPart,
  ServiceWiringContext,
  ServiceStopStage,
  ServiceStep,
  StartServiceOptions,
  ServiceLogEntry,
  Later,
} from "./types.ts";
const stages: readonly { stage: ServiceStopStage; step?: ServiceStep }[] = [
  { stage: "requests", step: "http-closed" },
  { stage: "commands" },
  { stage: "sources", step: "sources-stopped" },
  { stage: "notifications", step: "escalations-stopped" },
  { stage: "pulls", step: "revisions-idle" },
  { stage: "intake", step: "intake-stopped" },
  { stage: "delivery", step: "router-stopped" },
  { stage: "timers" },
  { stage: "store", step: "store-closed" },
];
const registries = new WeakMap<ServiceWiringContext, ImplementationRegistry[]>();
/** Assembly-private read used by the blueprint-loader wiring. */
export function implementationsFor(context: ServiceWiringContext): ImplementationRegistry {
  return serviceImplementations(
    Object.fromEntries(registries.get(context)!.map((registry, i) => [String(i), registry])),
  );
}
export function wiringPart<Needs extends object, Gives extends object>(
  part: ServiceWiringPart<Needs, Gives>,
): ServiceWiringPart<Needs, Gives> {
  return part;
}
export function assembleService(
  options: StartServiceOptions,
): ServiceAssembly<{ readonly log: (entry: ServiceLogEntry) => void }> {
  const log = options.log ?? stderrLog;
  type Part = ServiceWiringPart<never, object>;
  type Entry =
    | {
        part: Part;
        run: (members: object, context: ServiceWiringContext) => object | Promise<object>;
      }
    | { step: ServiceStep };
  const entries: Entry[] = [];
  function chain<Members extends object>(): ServiceAssembly<Members> {
    return {
      part<Gives extends object>(part: ServiceWiringPart<Members, Gives>) {
        if (entries.some((entry) => "part" in entry && entry.part.name === part.name))
          throw new TypeError(`Duplicate wiring part: ${part.name}`);
        entries.push({ part, run: (members, context) => part.start(members as Members, context) });
        return chain<Members & Gives>();
      },
      step(step) {
        entries.push({ step });
        return chain<Members>();
      },
      async start() {
        const members = { log };
        const values = new Map<Part, object>();
        const waiting = new Map<
          Part,
          { promise: Promise<object>; resolve: (value: object) => void }
        >();
        const stops: { stage: ServiceStopStage; name: string; stop: () => void | Promise<void> }[] =
          [];
        const implementations: ImplementationRegistry[] = [];
        let implementationsClosed = false;
        let stopping: Promise<void> | undefined;
        function step(name: ServiceStep, phase: "start" | "stop") {
          log({ level: "info", event: `${phase}-step`, message: name, detail: { step: name } });
          options.probes?.step?.(name);
          if (phase === "start") options.signal?.throwIfAborted();
        }
        function stop(): Promise<void> {
          stopping ??= (async () => {
            const errors: unknown[] = [];
            for (const stage of stages) {
              const selected = stops.filter((stop) => stop.stage === stage.stage).toReversed();
              if (!selected.length) continue;
              let failed = false;
              for (const operation of selected) {
                try {
                  await operation.stop();
                } catch (error) {
                  failed = true;
                  errors.push(error);
                  log({
                    level: "error",
                    event: "stop-failed",
                    message: `Failed stop step: ${stage.step ?? operation.name}`,
                  });
                }
              }
              if (!failed && stage.step) {
                try {
                  step(stage.step, "stop");
                } catch (error) {
                  errors.push(error);
                  log({
                    level: "error",
                    event: "stop-failed",
                    message: `Failed stop step: ${stage.step}`,
                  });
                }
              }
            }
            log({ level: "info", event: "stopped", message: "Service stopped" });
            if (errors.length) throw errors[0];
          })();
          return stopping;
        }
        function later<Gives extends object>(part: ServiceWiringPart<never, Gives>): Later<Gives> {
          if (!entries.some((entry) => "part" in entry && entry.part === part))
            throw new TypeError(`Wiring part not listed: ${part.name}`);
          let pending = waiting.get(part);
          if (!pending) {
            let resolve!: (value: object) => void;
            const promise = new Promise<object>((done) => {
              resolve = done;
            });
            pending = { promise, resolve };
            waiting.set(part, pending);
          }
          const promise = pending.promise;
          return {
            current: () => values.get(part) as Gives | undefined,
            get() {
              const value = values.get(part);
              if (!value) throw new TypeError(`Wiring part not started: ${part.name}`);
              return value as Gives;
            },
            ready(signal) {
              if (signal?.aborted) return Promise.reject(signal.reason);
              const value = values.get(part);
              if (value) return Promise.resolve(value as Gives);
              if (!signal) return promise as Promise<Gives>;
              return new Promise<Gives>((resolve, reject) => {
                const aborted = () => reject(signal.reason);
                signal.addEventListener("abort", aborted, { once: true });
                void promise.then((value) => {
                  signal.removeEventListener("abort", aborted);
                  resolve(value as Gives);
                });
              });
            },
          };
        }
        try {
          options.signal?.throwIfAborted();
          for (const entry of entries) {
            if ("step" in entry) {
              step(entry.step, "start");
              continue;
            }
            if (entry.part.name === "blueprint-loader") implementationsClosed = true;
            const context: ServiceWiringContext = {
              options,
              later,
              onStop(stage, stop) {
                stops.push({ stage, name: entry.part.name, stop });
              },
              addImplementations(registry) {
                if (implementationsClosed)
                  throw new TypeError(
                    `Implementations registered after blueprint-loader: ${entry.part.name}`,
                  );
                implementations.push(registry);
              },
            };
            registries.set(context, implementations);
            const added = await entry.run(members, context);
            Object.assign(members, added);
            values.set(entry.part, added);
            waiting.get(entry.part)?.resolve(added);
          }
          return { members: members as Members, stop };
        } catch (error) {
          await stop().catch(() => {});
          throw error;
        }
      },
    };
  }
  return chain();
}
