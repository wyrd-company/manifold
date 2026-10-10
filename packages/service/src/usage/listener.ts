// ---
// relationships:
//   implements: [usage-push, usage-api]
// ---
import { isUsageMoveRequest } from "@wyrd-company/manifold-shared/usage-api";
import { UsageMoveError } from "./moves.ts";
import type { Usage } from "./types.ts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  serviceConfigurationSchemas,
  usageRecordSchema,
  usagePushSchema,
} from "@wyrd-company/manifold-shared";
import type { UsagePushRequest, UsagePushResult } from "@wyrd-company/manifold-shared";
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
ajv.addSchema(usageRecordSchema);
const validate = ajv.compile<UsagePushRequest>(usagePushSchema);
export function usageListener(
  environments: ReadonlySet<string>,
  push: (request: UsagePushRequest) => UsagePushResult,
  onError: (error: unknown) => void,
  operator: Pick<Usage, "move" | "unowned">,
  readActor?: (
    actor: string,
  ) => import("@wyrd-company/manifold-shared/actor-usage-api").ActorUsageResponse,
): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    const answer = (status: number, body: unknown) => {
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(body));
    };
    const failure = (status: number, error: string, message: string) =>
      answer(status, { error, message });
    const run = async () => {
      const path = request.url?.split("?")[0] ?? "";
      if (path.startsWith("/api/usage/actors/") && readActor) {
        const segment = path.slice("/api/usage/actors/".length);
        let actor: string;
        try {
          actor = decodeURIComponent(segment);
        } catch {
          failure(404, "invalid-request", "Unknown usage path.");
          return;
        }
        if (!actor || segment.includes("/")) {
          failure(404, "invalid-request", "Unknown usage path.");
          return;
        }
        if (request.method !== "GET") {
          response.setHeader("allow", "GET");
          failure(405, "invalid-request", "Expected GET.");
          return;
        }
        response.setHeader("cache-control", "no-store");
        answer(200, readActor(actor));
        return;
      }
      if (!["/api/usage/push", "/api/usage/unowned", "/api/usage/moves"].includes(path ?? "")) {
        failure(404, "not-found", "Unknown usage path.");
        return;
      }
      const method = path === "/api/usage/unowned" ? "GET" : "POST";
      if (request.method !== method) {
        response.setHeader("allow", method);
        failure(405, "method-not-allowed", `Expected ${method}.`);
        return;
      }
      if (path === "/api/usage/unowned") {
        answer(200, { unowned: operator.unowned() });
        return;
      }
      const limit = path === "/api/usage/moves" ? 64 * 1024 : 8 * 1024 * 1024;
      if (
        request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json"
      ) {
        failure(415, "unsupported-media-type", "Expected application/json.");
        return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string);
        size += bytes.length;
        if (size > limit) {
          failure(413, "too-large", "Usage body is too large.");
          return;
        }
        chunks.push(bytes);
      }
      let value: unknown;
      try {
        value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        failure(400, "invalid-request", "Body is not JSON.");
        return;
      }
      if (path === "/api/usage/moves") {
        if (!isUsageMoveRequest(value)) {
          failure(400, "invalid-request", "Invalid usage move.");
          return;
        }
        try {
          answer(200, operator.move(value));
        } catch (error) {
          if (error instanceof UsageMoveError) {
            failure(422, error.code, error.message);
            return;
          }
          throw error;
        }
        return;
      }
      if (!validate(value)) {
        answer(400, {
          error: "invalid-request",
          message: "Invalid usage push.",
          issues: (validate.errors ?? []).map((error) => ({
            pointer: error.instancePath,
            message: error.message ?? "Invalid value.",
          })),
        });
        return;
      }
      if (!environments.has(value.environment)) {
        failure(422, "unknown-environment", "Environment is not configured.");
        return;
      }
      answer(200, push(value));
    };
    void run().catch((error: unknown) => {
      onError(error);
      if (!response.headersSent) failure(500, "internal", "Usage push failed.");
      else response.destroy();
    });
  };
}
