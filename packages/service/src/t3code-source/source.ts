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
  const environments = Object.keys(options.environments).map((name) =>
    environmentLoop(options, name, stop.signal),
  );
  return {
    status: () => environments.map((e) => ({ ...e.status })),
    async stop() {
      stop.abort();
      await Promise.all(environments.map((e) => e.done));
    },
  };
}
