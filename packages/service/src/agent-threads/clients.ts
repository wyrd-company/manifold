// ---
// relationships:
//   implements: agent-threads
// ---
import { readFile } from "node:fs/promises";
import {
  T3Client,
  T3PreconditionError,
  T3AuthError,
  T3ConnectionError,
} from "@wyrd-company/t3code-client";
import type { AgentThreadsOptions } from "./types.ts";
export function clients(options: AgentThreadsOptions, signal: AbortSignal) {
  const opened = new Map<string, T3Client>();
  const monitors = new Map<string, Promise<void>>();
  async function monitor(environment: string) {
    while (!signal.aborted) {
      const hold = options.holds!.held(environment);
      if (hold.disconnected) {
        const client = opened.get(environment);
        opened.delete(environment);
        await client?.close();
      }
      await options.holds!.changed(environment, hold.sequence, signal);
    }
  }
  return {
    get(environment: string) {
      if (options.holds?.held(environment).disconnected)
        throw new T3ConnectionError("closed", "Environment is disconnected");
      if (options.holds && !monitors.has(environment))
        monitors.set(
          environment,
          monitor(environment).catch((error: unknown) => {
            if (!signal.aborted)
              options.logger?.error("Environment holds monitor failed", { environment, error });
          }),
        );
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
              throw new T3AuthError(error instanceof Error ? error.message : String(error), {
                code: "auth_invalid",
                status: 401,
                method: "LOAD",
                path: "credential",
                body: null,
              });
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
      await Promise.all(monitors.values());
    },
  };
}
