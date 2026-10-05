// ---
// relationships:
//   implements: blueprints-api
// ---
import type { IncomingMessage, ServerResponse } from "node:http";
import { blueprintsApiPath } from "@wyrd-company/manifold-shared/blueprints-api";
import {
  ProcessRepositorySaveError,
  ProcessRepositoryPullError,
} from "../process-repository/index.ts";
import type { SaveRequest } from "../process-repository/index.ts";
import type { HttpHost } from "../http-host/index.ts";
import type { BlueprintsApiOptions } from "./types.ts";
import { catalog, sourceText, lintText } from "./catalog.ts";
const validPath = (path: unknown): path is string =>
  typeof path === "string" &&
  path.startsWith("blueprints/") &&
  /\.ya?ml$/.test(path) &&
  !path.includes("\\") &&
  path.split("/").every((s) => s !== "" && s !== "." && s !== "..");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function saveRequest(value: unknown): value is SaveRequest {
  return (
    record(value) &&
    Object.keys(value).every((key) =>
      ["path", "base", "text", "message", "saveId"].includes(key),
    ) &&
    validPath(value["path"]) &&
    typeof value["text"] === "string" &&
    typeof value["base"] === "string" &&
    /^([a-f0-9]{40}|[a-f0-9]{64})$/.test(value["base"]) &&
    typeof value["saveId"] === "string" &&
    /^[a-f0-9]{32}$/.test(value["saveId"]) &&
    typeof value["message"] === "string" &&
    value["message"].length <= 4096 &&
    value["message"].trim().length > 0
  );
}
function sameSite(request: IncomingMessage) {
  if (request.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const matches = (authority: string | string[] | undefined) =>
      typeof authority === "string" &&
      /^[^/?#@]+$/.test(authority) &&
      new URL(`${parsed.protocol}//${authority}`).host === parsed.host;
    return matches(request.headers.host) || matches(request.headers["x-forwarded-host"]);
  } catch {
    return false;
  }
}
export function mountBlueprintsApi(host: HttpHost, options: BlueprintsApiOptions) {
  host.mount(blueprintsApiPath, (request, response) => {
    void handle(request, response).catch((error) => {
      if (response.writableEnded) return;
      const message = error instanceof Error ? error.message : String(error);
      if (
        error instanceof ProcessRepositorySaveError ||
        error instanceof ProcessRepositoryPullError
      ) {
        const kind =
          error.kind === "authentication"
            ? "authentication"
            : error.kind === "rejected"
              ? "rejected"
              : "remote";
        answer(response, 502, { error: kind, message });
      } else if (error instanceof TypeError && message === "Revision follower is closed")
        answer(response, 503, { error: "unavailable", message });
      else {
        options.log({ level: "error", path: request.url ?? "", error: message });
        answer(response, 500, { error: "internal", message: "Blueprint request failed." });
      }
    });
  });
  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://example.test");
    const path = url.pathname.slice(blueprintsApiPath.length);
    const method =
      path === "" || path === "/source"
        ? "GET"
        : path === "/lint" || path === "/save"
          ? "POST"
          : undefined;
    const failure = (status: number, error: string, message: string) =>
      answer(response, status, { error, message });
    if (!method) {
      failure(404, "not-found", "Unknown blueprint endpoint.");
      return;
    }
    if (request.method !== method) {
      response.setHeader("Allow", method);
      failure(405, "method-not-allowed", `Expected ${method}.`);
      return;
    }
    if (method === "GET") {
      if (path === "") {
        answer(response, 200, await catalog(options));
        return;
      }
      const blueprintPath = url.searchParams.get("path");
      if (!validPath(blueprintPath)) {
        failure(400, "bad-request", "Expected a blueprint path.");
        return;
      }
      const source = await sourceText(options, blueprintPath);
      if (!source) {
        failure(
          options.revisions.latest() ? 404 : 503,
          options.revisions.latest() ? "not-found" : "unavailable",
          "Blueprint source unavailable.",
        );
        return;
      }
      answer(response, 200, source);
      return;
    }
    if (
      request.headers["content-type"]?.split(";")[0]?.trim().toLowerCase() !== "application/json"
    ) {
      failure(415, "unsupported-media-type", "Expected application/json.");
      return;
    }
    if (!sameSite(request)) {
      failure(403, "cross-site", "Cross-site blueprint writes are refused.");
      return;
    }
    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > 8 * 1024 * 1024) {
        failure(413, "too-large", "Blueprint body exceeds 8 MiB.");
        return;
      }
      chunks.push(buffer);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString());
    } catch {
      failure(400, "bad-request", "Expected JSON.");
      return;
    }
    if (!record(body) || !validPath(body["path"]) || typeof body["text"] !== "string") {
      failure(400, "bad-request", "Expected path and text.");
      return;
    }
    if (path === "/lint" && Object.keys(body).some((key) => key !== "path" && key !== "text")) {
      failure(400, "bad-request", "Unexpected lint property.");
      return;
    }
    if (path === "/save" && !saveRequest(body)) {
      failure(400, "bad-request", "Expected base, message and saveId.");
      return;
    }
    const lint = await lintText(options, body["path"], body["text"]);
    if (path === "/lint") {
      answer(response, 200, lint);
      return;
    }
    if (!options.revisions.latest()) {
      failure(503, "unavailable", "No applied process repository revision.");
      return;
    }
    if (lint.findings.length) {
      answer(response, 422, {
        error: "invalid",
        message: "Blueprint has findings.",
        findings: lint.findings,
        warnings: lint.warnings,
      });
      return;
    }
    // Shape was validated above at the HTTP boundary.
    const result = await options.revisions.save(body as unknown as SaveRequest);
    if (result.outcome === "conflict") {
      answer(response, 409, {
        error: "conflict",
        message: "The process repository branch changed.",
        reason: result.reason,
        head: result.head,
        ...(result.text === undefined ? {} : { text: result.text }),
      });
      return;
    }
    const blueprint = result.blueprints
      ? (await catalog(options, result.blueprints)).blueprints.find(
          (item) => item.path === body["path"],
        )
      : undefined;
    answer(response, 200, {
      outcome: result.outcome,
      commit: result.commit,
      ...(blueprint ? { blueprint } : {}),
    });
  }
}
function answer(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
