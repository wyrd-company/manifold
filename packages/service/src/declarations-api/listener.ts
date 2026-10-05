// ---
// relationships:
//   implements: declarations-api
// ---
import type { IncomingMessage, ServerResponse } from "node:http";
import { declarationsApiPath } from "@wyrd-company/manifold-shared/declarations-api";
import type {
  DeclarationPath,
  BindingEdit,
  TaskFieldEdit,
  SaveFields,
} from "@wyrd-company/manifold-shared/declarations-api";
import type { HttpHost } from "../http-host/index.ts";
import { jsonContent, sameSite } from "../http-host/request-checks.ts";
import { failureAnswer, saveAnswer } from "../blueprints-api/answers.ts";
import {
  record,
  validPath,
  saveFields,
  bindingEdit,
  taskFieldEdit,
  onlyKeys,
} from "./request-checks.ts";
import { lintAnswer, bindingsAnswer } from "./answers.ts";
import { editBindings } from "./binding-edit.ts";
import { editTaskFields } from "./task-field-edit.ts";
import type { DeclarationsApiOptions } from "./types.ts";
export function mountDeclarationsApi(host: HttpHost, options: DeclarationsApiOptions): void {
  host.mount(declarationsApiPath, (request, response) => {
    void handle(request, response).catch((error) => {
      if (response.writableEnded) return;
      const result = failureAnswer(error);
      if (result.status === 500)
        options.log({
          level: "error",
          path: request.url ?? "",
          error: error instanceof Error ? error.message : String(error),
        });
      answer(response, result.status, {
        ...result.body,
        ...(result.status === 500 ? { message: "Declaration request failed." } : {}),
      });
    });
  });
  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://example.test");
    const path = url.pathname.slice(declarationsApiPath.length);
    const method =
      path === "/source" || path === "/bindings"
        ? "GET"
        : ["/lint", "/save", "/task-fields/edit", "/bindings/save"].includes(path)
          ? "POST"
          : undefined;
    const fail = (status: number, error: string, message: string) =>
      answer(response, status, { error, message });
    if (!method) return fail(404, "not-found", "Unknown declaration endpoint.");
    if (request.method !== method) {
      response.setHeader("Allow", method);
      return fail(405, "method-not-allowed", `Expected ${method}.`);
    }
    let body: Record<string, unknown> = {};
    let declarationPath: DeclarationPath | undefined;
    let fieldEdit: TaskFieldEdit | undefined;
    let binding: BindingEdit | undefined;
    let save: SaveFields | undefined;
    if (method === "GET" && path === "/source") {
      const value = url.searchParams.get("path");
      if (!validPath(value)) return fail(400, "bad-request", "Expected a declaration path.");
      declarationPath = value;
    }
    if (method === "POST") {
      if (!jsonContent(request.headers))
        return fail(415, "unsupported-media-type", "Expected application/json.");
      if (!sameSite(request.headers))
        return fail(403, "cross-site", "Cross-site declaration writes are refused.");
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > 8 * 1024 * 1024)
          return fail(413, "too-large", "Declaration body exceeds 8 MiB.");
        chunks.push(buffer);
      }
      let value: unknown;
      try {
        value = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        return fail(400, "bad-request", "Expected JSON.");
      }
      if (!record(value)) return fail(400, "bad-request", "Expected a request object.");
      body = value;
      if (path === "/lint" || path === "/save") {
        if (!validPath(body["path"]) || typeof body["text"] !== "string")
          return fail(400, "bad-request", "Expected a declaration path and text.");
        declarationPath = body["path"];
        if (
          !onlyKeys(
            body,
            path === "/lint" ? ["path", "text"] : ["path", "text", "base", "message", "saveId"],
          )
        )
          return fail(400, "bad-request", "Unexpected request property.");
        if (path === "/save" && !saveFields(body))
          return fail(400, "bad-request", "Expected base, message and saveId.");
        if (path === "/save") save = body as unknown as SaveFields;
      } else if (path === "/task-fields/edit") {
        if (
          !onlyKeys(body, ["text", "edit"]) ||
          typeof body["text"] !== "string" ||
          !taskFieldEdit(body["edit"])
        )
          return fail(400, "bad-request", "Expected text and a field edit.");
        fieldEdit = body["edit"];
      } else if (
        !onlyKeys(body, ["edit", "base", "message", "saveId"]) ||
        !bindingEdit(body["edit"]) ||
        !saveFields(body)
      )
        return fail(400, "bad-request", "Expected a binding edit, base, message and saveId.");
      else {
        binding = body["edit"];
        save = body;
      }
    }
    const latest = options.revisions.latest();
    const revision = latest ? await options.processRepository.revisionAt(latest.commit) : undefined;
    if (!revision) return fail(503, "unavailable", "No applied process repository revision.");
    if (path === "/bindings") return answer(response, 200, await bindingsAnswer(options, revision));
    if (path === "/source") {
      const text = await revision.read(declarationPath!);
      return answer(response, 200, {
        path: declarationPath,
        commit: revision.commit,
        exists: text !== undefined,
        text: text ?? "",
        ...(await lintAnswer(options, revision, declarationPath!, text ?? "")),
      });
    }
    let text = typeof body["text"] === "string" ? body["text"] : "";
    if (path === "/task-fields/edit") {
      const result = editTaskFields(text, fieldEdit!);
      if (!result.ok && result.findings[0]?.kind === "bad-binding")
        return fail(400, "bad-request", "Expected a declared Project binding name.");
      if (!result.ok)
        return answer(response, 422, {
          error: "invalid",
          message: "Field edit has findings.",
          findings: result.findings,
          warnings: [],
        });
      return answer(response, 200, {
        text: result.text,
        location: result.location,
        ...(await lintAnswer(options, revision, "task-metadata.yml", result.text)),
      });
    }
    if (path === "/bindings/save") {
      const base = await options.processRepository.revisionAt(save!.base);
      if (!base) return fail(400, "bad-request", "Unknown base revision.");
      const result = editBindings((await base.read("bindings.yml")) ?? "", binding!);
      if (!result.ok)
        return answer(response, 422, {
          error: "invalid",
          message: "Binding edit has findings.",
          findings: result.findings,
          warnings: [],
        });
      text = result.text;
      declarationPath = "bindings.yml";
    }
    const lint = await lintAnswer(options, revision, declarationPath!, text);
    if (path === "/lint") return answer(response, 200, lint);
    if (lint.findings.length)
      return answer(response, 422, {
        error: "invalid",
        message: "Declaration has findings.",
        findings: lint.findings,
        warnings: lint.warnings,
      });
    const result = await options.revisions.save({
      path: declarationPath!,
      text,
      base: save!.base,
      message: save!.message,
      saveId: save!.saveId,
    });
    const mapped = saveAnswer(result);
    return answer(
      response,
      mapped.status,
      result.outcome === "conflict"
        ? mapped.body
        : { ...mapped.body, loaded: result.blueprints !== undefined },
    );
  }
}
function answer(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}
