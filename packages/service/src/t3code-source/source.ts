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
    const writes = new Set<Promise<void>>();
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
        await Promise.all(writes);
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
    async write(name, signal, send) {
      const environment = environments.find((entry) => entry.status.environment === name);
      while (true) {
        await source.ready(name, signal);
        signal.throwIfAborted();
        // Check and acquire without yielding: invalidation cannot interleave.
        if (!environment!.readiness.ready) continue;
        let release!: () => void;
        const pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        environment!.writes.add(pending);
        try {
          return await send();
        } finally {
          environment!.writes.delete(pending);
          release();
        }
      }
    },
    async stop() {
      stop.abort();
      await Promise.all(environments.map((e) => e.done));
    },
  };
  return source;
}
