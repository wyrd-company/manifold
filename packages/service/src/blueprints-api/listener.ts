// ---
// relationships:
//   implements: blueprints-api
// ---
import type { IncomingMessage, ServerResponse } from "node:http";
import { blueprintsApiPath } from "@wyrd-company/manifold-shared/blueprints-api";
import type { HttpHost } from "../http-host/index.ts";
import type { BlueprintsApiOptions } from "./types.ts";
import { catalog, sourceText, lintText } from "./catalog.ts";
import { validPath, saveRequest, textRequest, lintRequest } from "./request-checks.ts";
import { sameSite, jsonContent } from "../http-host/request-checks.ts";
import { saveAnswer, invalidAnswer, failureAnswer } from "./answers.ts";
export function mountBlueprintsApi(host: HttpHost, options: BlueprintsApiOptions) {
  host.mount(blueprintsApiPath, (request, response) => {
    void handle(request, response).catch((error) => {
      if (response.writableEnded) return;
      const result = failureAnswer(error);
      if (result.status === 500)
        options.log({
          level: "error",
          path: request.url ?? "",
          error: error instanceof Error ? error.message : String(error),
        });
      answer(response, result.status, result.body);
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
    if (!jsonContent(request.headers)) {
      failure(415, "unsupported-media-type", "Expected application/json.");
      return;
    }
    if (!sameSite(request.headers)) {
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
    if (!textRequest(body)) {
      failure(400, "bad-request", "Expected path and text.");
      return;
    }
    if (path === "/lint" && !lintRequest(body)) {
      failure(400, "bad-request", "Unexpected lint property.");
      return;
    }
    const save = path === "/save" && saveRequest(body) ? body : undefined;
    if (path === "/save" && !save) {
      failure(400, "bad-request", "Expected base, message and saveId.");
      return;
    }
    if (
      path === "/lint" &&
      body.base !== undefined &&
      !(await options.processRepository.revisionAt(body.base))
    ) {
      failure(400, "bad-request", "Unknown base revision.");
      return;
    }
    const lint = await lintText(
      options,
      body["path"],
      body["text"],
      path === "/lint" ? body.base : undefined,
      body.models,
    );
    if (path === "/lint") {
      answer(response, 200, lint);
      return;
    }
    if (!options.revisions.latest()) {
      failure(503, "unavailable", "No applied process repository revision.");
      return;
    }
    if (lint.findings.length) {
      answer(response, 422, invalidAnswer(lint));
      return;
    }
    const result = await options.revisions.save({
      files: [{ path: save!.path, text: save!.text }],
      base: save!.base,
      message: save!.message,
      saveId: save!.saveId,
    });
    const blueprint =
      result.outcome !== "conflict" && result.blueprints
        ? (await catalog(options, result.blueprints)).blueprints.find(
            (item) => item.path === body.path,
          )
        : undefined;
    const mapped = saveAnswer(result, blueprint);
    answer(response, mapped.status, mapped.body);
  }
}
function answer(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
