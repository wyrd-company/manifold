// ---
// relationships:
//   implements: agent-tools
// ---
import type { RequestListener } from "node:http";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  agentToolsSchema,
  escalationContractSchema,
  serviceConfigurationSchemas,
} from "@wyrd-company/manifold-shared";
import type { EscalateInput } from "../escalations/index.ts";
import { CallRefused, refuse } from "./types.ts";
import type { CallRequest, AgentToolsOptions } from "./types.ts";
import { identify } from "./identify.ts";
import { handoff } from "./handoff.ts";
import type { NoticeRequest } from "./messages.ts";
import { messages } from "./messages.ts";
import { escalate } from "./escalate.ts";
const ajv = new Ajv2020({ allErrors: true, useDefaults: true });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
ajv.addSchema(escalationContractSchema);
ajv.addSchema(agentToolsSchema);
const requestSchema = ajv.compile<CallRequest>({
  $ref: agentToolsSchema.$id + "#/$defs/call-request",
});
const handoffSchema = ajv.compile<{ handoff: unknown; thread?: string }>({
  $ref: agentToolsSchema.$id + "#/$defs/handoff-input",
});
const escalateSchema = ajv.compile<EscalateInput & { thread?: string }>({
  $ref: agentToolsSchema.$id + "#/$defs/escalate-input",
});
const noticeSchema = ajv.compile<NoticeRequest>({
  $ref: agentToolsSchema.$id + "#/$defs/notice-request",
});
const readSchema = ajv.compile({ $ref: agentToolsSchema.$id + "#/$defs/get-messages-input" });
export function listener(
  options: AgentToolsOptions,
  signal: AbortSignal,
  mail: ReturnType<typeof messages>,
): RequestListener {
  return (request, response) => {
    void (async () => {
      let status = 200;
      let result: unknown;
      try {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;
        if (path !== "/api/agent-tools/calls" && path !== "/api/agent-tools/notices")
          refuse("invalid-request", "Unknown path.", 404);
        if (request.method !== "POST") refuse("invalid-request", "Use POST.", 405);
        let size = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of request) {
          const bytes = Buffer.from(chunk as Uint8Array);
          size += bytes.length;
          if (size > (path.endsWith("/notices") ? 64 * 1024 : 1024 * 1024))
            refuse(
              "invalid-request",
              path.endsWith("/notices") ? "Body exceeds 64 KiB." : "Body exceeds 1 MiB.",
              413,
            );
          chunks.push(bytes);
        }
        let value: unknown;
        try {
          value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          refuse("invalid-request", "Expected JSON.", 400);
        }
        if (path.endsWith("/notices")) {
          if (!noticeSchema(value))
            refuse(
              "invalid-request",
              "Correct the notice request fields.",
              400,
              (noticeSchema.errors ?? []).map((error) => ({
                path: error.instancePath,
                message: error.message ?? "Invalid request",
              })),
            );
          if (!options.environments.has(value.environment))
            refuse("unknown-environment", "Unknown environment.", 404);
          const disconnected = new AbortController();
          const closed = () => disconnected.abort();
          response.once("close", closed);
          if (response.destroyed) disconnected.abort();
          try {
            result = await mail.notice(value, AbortSignal.any([signal, disconnected.signal]));
          } finally {
            response.removeListener("close", closed);
          }
        } else {
          if (!requestSchema(value))
            refuse(
              "invalid-request",
              "Correct the request fields.",
              400,
              (requestSchema.errors ?? []).map((error) => ({
                path: error.instancePath,
                message: error.message ?? "Invalid request",
              })),
            );
          if (!options.environments.has(value.environment))
            refuse("unknown-environment", "Unknown environment.", 404);
          const validator =
            value.tool === "handoff"
              ? handoffSchema
              : value.tool === "escalate"
                ? escalateSchema
                : readSchema;
          if (!validator(value.arguments))
            refuse(
              value.tool === "handoff"
                ? "invalid-handoff"
                : value.tool === "escalate"
                  ? "invalid-escalation"
                  : "invalid-request",
              "Correct the tool arguments.",
              value.tool === "get-messages" ? 400 : 422,
              (validator.errors ?? []).map((error) => ({
                path: error.instancePath,
                message: error.message ?? "Invalid arguments",
              })),
            );
          if (value.tool === "escalate") {
            const input = value.arguments as unknown as EscalateInput;
            if (
              new Set(input.choices?.map((choice) => choice.id)).size !==
              (input.choices?.length ?? 0)
            )
              refuse("invalid-escalation", "Choice ids must be unique.", 422, [
                { path: "/choices", message: "Choice ids must be unique" },
              ]);
          }
          const identity = await identify(options, value, signal);
          result =
            value.tool === "handoff"
              ? handoff(options, identity, value.arguments["handoff"])
              : value.tool === "escalate"
                ? escalate(options, identity, value.arguments as unknown as EscalateInput)
                : mail.read(identity);
        }
      } catch (error) {
        if (error instanceof CallRefused) {
          status = error.status;
          result = error.response;
        } else {
          status = 500;
          result = {
            status: "refused",
            code: "invalid-request",
            message: "The service could not accept the call. Calling again in this turn is safe.",
          };
          options.log({ level: "error", event: "agent-call-failed", message: String(error) });
        }
      }
      if (!response.destroyed) {
        response.writeHead(status, { "Content-Type": "application/json" });
        response.end(JSON.stringify(result));
      }
    })();
  };
}
