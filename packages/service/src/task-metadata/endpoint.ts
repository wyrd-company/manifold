// ---
// relationships:
//   implements: projects-api
// ---
import type { IncomingMessage } from "node:http";
import type { HttpListener } from "../http-host/index.ts";
import type { ApplyRequest, ProjectConfiguration } from "./project-types.ts";
import { ProjectRequestError } from "./projects.ts";
async function body(request: IncomingMessage): Promise<ApplyRequest> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new ProjectRequestError(400, "invalid-request", "Expected Apply JSON body");
  }
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("removeUndeclared" in value) ||
    typeof value.removeUndeclared !== "boolean" ||
    Object.keys(value).some((k) => k !== "removeUndeclared" && k !== "digest") ||
    ("digest" in value &&
      (typeof value.digest !== "string" || !/^[0-9a-f]{64}$/.test(value.digest)))
  )
    throw new ProjectRequestError(400, "invalid-request", "Invalid Apply request");
  return value as ApplyRequest;
}
export function projectsEndpoint(projects: ProjectConfiguration): HttpListener {
  return (request, response) => {
    const controller = new AbortController();
    response.once("close", () => controller.abort());
    const send = (status: number, value: unknown) => {
      if (response.destroyed || response.writableEnded) return;
      response.writeHead(status, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(value));
    };
    void (async () => {
      const path = new URL(request.url ?? "/", "http://localhost").pathname.replace(/\/$/, "");
      const route = path.match(/^\/api\/projects\/([^/]+)\/(plan|apply)$/);
      const list = path === "/api/projects";
      if (!list && !route)
        throw new ProjectRequestError(404, "not-found", "Projects endpoint not found");
      const method = route?.[2] === "apply" ? "POST" : "GET";
      if (request.method !== method) {
        response.setHeader("Allow", method);
        throw new ProjectRequestError(405, "method-not-allowed", `Use ${method}`);
      }
      if (list) return send(200, { projects: projects.list() });
      let binding;
      try {
        binding = decodeURIComponent(route![1]!);
      } catch {
        throw new ProjectRequestError(400, "invalid-request", "Invalid binding name");
      }
      send(
        200,
        route![2] === "plan"
          ? await projects.plan(binding, controller.signal)
          : await projects.apply(binding, await body(request)),
      );
    })().catch((error) => {
      const failure =
        error instanceof ProjectRequestError
          ? error
          : new ProjectRequestError(
              502,
              "transport",
              error instanceof Error ? error.message : "Project request failed",
            );
      const { commit, ...detail } = failure.detail;
      send(failure.status, {
        error: { kind: failure.kind, message: failure.message, ...(commit ? { commit } : {}) },
        ...(failure.status === 502 ? detail : {}),
      });
    });
  };
}
