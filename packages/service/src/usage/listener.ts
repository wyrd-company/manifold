// ---
// relationships:
//   implements: usage-push
// ---
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
): (request: IncomingMessage, response: ServerResponse) => void {
  return (request, response) => {
    const answer = (status: number, body: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(body));
    };
    const failure = (status: number, error: string, message: string) =>
      answer(status, { error, message });
    const run = async () => {
      if (request.url?.split("?")[0] !== "/api/usage/push") {
        failure(404, "invalid-request", "Unknown usage path.");
        return;
      }
      if (request.method !== "POST") {
        response.setHeader("allow", "POST");
        failure(405, "invalid-request", "Expected POST.");
        return;
      }
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
        if (size > 8 * 1024 * 1024) {
          failure(413, "too-large", "Usage body exceeds 8 MiB.");
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
    void run().catch(() => {
      if (!response.headersSent) failure(500, "internal", "Usage push failed.");
      else response.destroy();
    });
  };
}
