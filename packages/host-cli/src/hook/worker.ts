// ---
// relationships:
//   implements: host-cli-hook
// ---
import { statSync } from "node:fs";
import { parentPort, workerData } from "node:worker_threads";
import { readSessionMappings } from "../usage-push/mappings.ts";
import { agentToolsSchema, createSchemaCompiler } from "@wyrd-company/manifold-shared";
import type { HookConfiguration } from "./command.ts";
const { config, input } = workerData as {
  config: HookConfiguration;
  input: Record<string, unknown>;
};
async function run() {
  try {
    statSync(config.databasePath);
    const sessionId = typeof input["session_id"] === "string" ? input["session_id"] : undefined;
    const callId =
      typeof input["tool_use_id"] === "string" && input["tool_use_id"]
        ? input["tool_use_id"]
        : undefined;
    const threadId = sessionId
      ? readSessionMappings(config.databasePath).find(
          (mapping) =>
            mapping.provider === config.provider && mapping.providerSessionId === sessionId,
        )?.threadId
      : undefined;
    if (!threadId && !callId) throw Error("No mapped session or tool call id");
    const response = await fetch(config.service + "/api/agent-tools/notices", {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        environment: config.environment,
        ...(threadId ? { threadId } : {}),
        ...(callId ? { callId } : {}),
      }),
    });
    const body: unknown = await response.json();
    const validate = createSchemaCompiler()([
      { $ref: agentToolsSchema.$id + "#/$defs/notice-response" },
    ])[0]!;
    if (!response.ok || !validate(body)) throw Error("Invalid notice response");
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- Node MessagePort has no target origin.
    parentPort!.postMessage(body);
  } catch (error) {
    // eslint-disable-next-line unicorn/require-post-message-target-origin -- Node MessagePort has no target origin.
    parentPort!.postMessage({ notice: null, error: String(error) });
  }
}
void run();
