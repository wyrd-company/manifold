// ---
// relationships:
//   implements: t3code-environment-source
// ---
import { migrations } from "./migrations.ts";
import { environmentLoop } from "./environment.ts";
import type { T3CodeSourceOptions, T3CodeSource } from "./types.ts";
export function startT3CodeSource(options: T3CodeSourceOptions): T3CodeSource {
  options.store.connection.migrate("tthree", migrations);
  const stop = new AbortController();
  const environmentError = (name: string) =>
    Object.assign(new Error(`T3 Code environment ${name} is unavailable`), {
      name: "AgentThreadError",
      kind: "environment",
    });
  const environments = Object.keys(options.environments).map((name) => {
    function pendingReadiness() {
      let resolve!: () => void;
      let reject!: (error: unknown) => void;
      const promise = new Promise<void>((yes, no) => {
        resolve = yes;
        reject = no;
      });
      void promise.catch(() => {});
      return { promise, resolve, reject, ready: false };
    }
    let readiness = pendingReadiness();
    const loop = environmentLoop(
      options,
      name,
      stop.signal,
      () => {
        readiness.ready = true;
        readiness.resolve();
      },
      () => {
        if (readiness.ready) readiness = pendingReadiness();
      },
    );
    void loop.done.then(
      () => readiness.reject(environmentError(name)),
      () => readiness.reject(environmentError(name)),
    );
    return {
      ...loop,
      get readiness() {
        return readiness;
      },
    };
  });
  return {
    status: () => environments.map((e) => ({ ...e.status })),
    ready(name, signal) {
      const environment = environments.find((entry) => entry.status.environment === name);
      if (!environment || stop.signal.aborted || environment.status.state === "stopped")
        return Promise.reject(environmentError(name));
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise<void>((resolve, reject) => {
        const aborted = () => {
          signal?.removeEventListener("abort", aborted);
          reject(signal?.reason);
        };
        signal?.addEventListener("abort", aborted, { once: true });
        void environment.readiness.promise.then(
          () => {
            signal?.removeEventListener("abort", aborted);
            resolve();
          },
          (error: unknown) => {
            signal?.removeEventListener("abort", aborted);
            reject(error);
          },
        );
      });
    },
    async stop() {
      stop.abort();
      await Promise.all(environments.map((e) => e.done));
    },
  };
}
