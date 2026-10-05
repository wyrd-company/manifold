// ---
// relationships:
//   implements: t3code-environment-source
// ---
import { T3ConnectionError } from "@wyrd-company/t3code-client";
import { persistence } from "./persistence.ts";
import { threadState } from "./state.ts";
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
    const writes = new Map<AbortController, string>();
    const stored = persistence(options.store, name);
    const loop = environmentLoop(
      options,
      name,
      stop.signal,
      () => {
        readiness.ready = true;
        readiness.resolve();
      },
      async () => {
        if (readiness.ready) readiness = pendingReadiness();
        // A request may already have committed even when its response is aborted.
        // Keep its thread outside the replacement baseline until observation catches up.
        stored.atomic(() => {
          for (const id of writes.values()) {
            const row = stored.row(id);
            stored.save(id, "followed", row?.cursor ?? stored.environment()!.shell_sequence, null);
          }
        });
        for (const controller of writes.keys())
          controller.abort(new T3ConnectionError("closed", "T3 Code environment identity changed"));
      },
    );
    void loop.done.then(
      () => readiness.reject(environmentError(name)),
      () => readiness.reject(environmentError(name)),
    );
    return {
      ...loop,
      writes,
      get readiness() {
        return readiness;
      },
    };
  });
  const source: T3CodeSource = {
    thread(name, threadId) {
      const configuration = options.environments[name];
      if (!configuration) return undefined;
      const stored = persistence(options.store, name),
        environment = stored.environment(),
        row = stored.row(threadId);
      if (!environment || !row?.thread) return undefined;
      const turn = threadState(row.thread).turn?.state;
      return {
        title: row.thread.title,
        url: `${configuration.url.replace(/\/$/, "")}/${encodeURIComponent(environment.environment_id)}/${encodeURIComponent(threadId)}`,
        ...(turn ? { turn: turn as "running" | "completed" | "interrupted" | "error" } : {}),
        archived: row.status !== "followed",
      };
    },
    async environmentId(name, signal) {
      await source.ready(name, signal);
      return persistence(options.store, name).environment()!.environment_id;
    },
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
    async write(name, thread, signal, send) {
      const environment = environments.find((entry) => entry.status.environment === name);
      while (true) {
        await source.ready(name, signal);
        signal.throwIfAborted();
        // Check and acquire without yielding: invalidation cannot interleave.
        if (!environment!.readiness.ready) continue;
        const controller = new AbortController();
        const writeSignal = AbortSignal.any([signal, controller.signal, stop.signal]);
        writeSignal.throwIfAborted();
        let interrupted!: () => void;
        const interruption = new Promise<never>((_resolve, reject) => {
          interrupted = () => reject(writeSignal.reason);
          writeSignal.addEventListener("abort", interrupted, { once: true });
        });
        environment!.writes.set(controller, thread);
        try {
          const result = await Promise.race([send(writeSignal), interruption]);
          writeSignal.throwIfAborted();
          return result;
        } finally {
          writeSignal.removeEventListener("abort", interrupted);
          environment!.writes.delete(controller);
        }
      }
    },
    async stop() {
      for (const environment of environments)
        for (const controller of environment.writes.keys())
          controller.abort(environmentError(environment.status.environment));
      stop.abort();
      await Promise.all(environments.map((e) => e.done));
    },
  };
  return source;
}
