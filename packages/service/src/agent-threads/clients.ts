// ---
// relationships:
//   implements: agent-threads
// ---
import { readFile } from "node:fs/promises";
import { T3Client, T3PreconditionError } from "@wyrd-company/t3code-client";
import type { AgentThreadsOptions } from "./types.ts";
import { failure } from "./types.ts";
export function clients(options: AgentThreadsOptions) {
  const opened = new Map<string, T3Client>();
  return {
    get(environment: string) {
      let client = opened.get(environment);
      if (client) return client;
      const config = options.environments[environment]!;
      client = T3Client.create({
        baseUrl: config.url,
        backoff: config.reconnect,
        pingIntervalMs: config.heartbeat.intervalMs,
        missedPongLimit: config.heartbeat.missedPongLimit,
        openTimeoutMs: config.openTimeoutMs,
        ...(options.logger ? { logger: options.logger } : {}),
        credentials: {
          async load() {
            try {
              return {
                accessToken: (await readFile(options.tokenFile(config.credential), "utf8")).trim(),
                scopes: ["orchestration:read", "orchestration:operate"],
              };
            } catch (error) {
              throw failure("unauthorized", error instanceof Error ? error.message : String(error));
            }
          },
          async save() {
            throw new T3PreconditionError("Manifold does not write T3 Code credentials");
          },
          async clear() {
            throw new T3PreconditionError("Manifold does not clear T3 Code credentials");
          },
        },
      });
      opened.set(environment, client);
      return client;
    },
    async close() {
      await Promise.all([...opened.values()].map((client) => client.close()));
      opened.clear();
    },
  };
}
