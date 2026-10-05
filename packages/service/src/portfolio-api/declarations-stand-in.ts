// ---
// relationships:
//   implements: portfolio-api
// ---
// Temporary DeclarationEditorApi composition. Remove after 1174 merges.
import { lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import type { HttpHost } from "../http-host/index.ts";
import type { Revisions } from "../service/index.ts";
import type { ProcessRepository } from "../process-repository/index.ts";
import { sameSite, jsonContent } from "../blueprints-api/request-checks.ts";
import { failureAnswer } from "../blueprints-api/answers.ts";
import { lintAllocatedAccounts } from "./account-lint-stand-in.ts";
export function mountDeclarationStandIn(
  host: HttpHost,
  options: { revisions: Revisions; processRepository: ProcessRepository },
) {
  host.mount("/api/declarations", (req, res) => {
    const answer = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify(body));
    };
    void (async () => {
      const url = new URL(req.url ?? "/", "http://example.test"),
        route = url.pathname;
      const method =
        route === "/api/declarations/source"
          ? "GET"
          : route === "/api/declarations/lint" || route === "/api/declarations/save"
            ? "POST"
            : undefined;
      if (!method) {
        answer(404, { error: "not-found", message: "Unknown declaration endpoint." });
        return;
      }
      if (req.method !== method) {
        res.setHeader("Allow", method);
        answer(405, { error: "method-not-allowed", message: `Expected ${method}.` });
        return;
      }
      const loaded = options.revisions.latest();
      if (!loaded) {
        answer(503, { error: "unavailable", message: "No applied revision." });
        return;
      }
      const revision = await options.processRepository.revisionAt(loaded.commit);
      if (!revision) throw Error("Revision unavailable.");
      const lint = async (text: string) => {
        const [bindings, accounts] = await Promise.all([
          revision.read("bindings.yml"),
          revision.read("accounts.yml"),
        ]);
        const checked = lintPortfolioDeclaration({ portfolio: text, bindings });
        return {
          findings: checked.ok ? [] : checked.findings,
          warnings: lintAllocatedAccounts({ portfolio: text, accounts }),
        };
      };
      if (method === "GET") {
        if (url.searchParams.get("path") !== "portfolio.yml") {
          answer(400, { error: "bad-request", message: "Expected portfolio.yml." });
          return;
        }
        const text = await revision.read("portfolio.yml");
        answer(200, {
          path: "portfolio.yml",
          commit: revision.commit,
          exists: text !== undefined,
          text: text ?? "",
          ...(await lint(text ?? "")),
        });
        return;
      }
      if (!jsonContent(req.headers)) {
        answer(415, { error: "unsupported-media-type", message: "Expected application/json." });
        return;
      }
      if (!sameSite(req.headers)) {
        answer(403, { error: "cross-site", message: "Cross-site writes refused." });
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const b = Buffer.from(chunk);
        size += b.length;
        if (size > 8 * 1024 * 1024) {
          answer(413, { error: "too-large", message: "Body exceeds 8 MiB." });
          return;
        }
        chunks.push(b);
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        answer(400, { error: "bad-request", message: "Expected JSON." });
        return;
      }
      if (
        typeof body !== "object" ||
        body === null ||
        !("path" in body) ||
        body.path !== "portfolio.yml" ||
        !("text" in body) ||
        typeof body.text !== "string"
      ) {
        answer(400, { error: "bad-request", message: "Expected portfolio.yml and text." });
        return;
      }
      const saving = route.endsWith("/save");
      const allowed = saving ? ["path", "text", "base", "saveId", "message"] : ["path", "text"];
      if (Object.keys(body).some((k) => !allowed.includes(k))) {
        answer(400, { error: "bad-request", message: "Unexpected property." });
        return;
      }
      const findings = await lint(body.text);
      if (!saving) {
        answer(200, findings);
        return;
      }
      if (
        !("base" in body) ||
        typeof body.base !== "string" ||
        !/^([a-f0-9]{40}|[a-f0-9]{64})$/.test(body.base) ||
        !("saveId" in body) ||
        typeof body.saveId !== "string" ||
        !/^[a-f0-9]{32}$/.test(body.saveId) ||
        !("message" in body) ||
        typeof body.message !== "string" ||
        !body.message.trim() ||
        body.message.length > 4096
      ) {
        answer(400, { error: "bad-request", message: "Expected base, saveId and message." });
        return;
      }
      if (findings.findings.length) {
        answer(422, { error: "invalid", message: "Declaration has findings.", ...findings });
        return;
      }
      const result = await options.revisions.save({
        path: "portfolio.yml",
        base: body.base,
        text: body.text,
        saveId: body.saveId,
        message: body.message,
      });
      if (result.outcome === "conflict") {
        answer(409, {
          error: "conflict",
          message: "The process repository branch changed.",
          reason: result.reason,
          head: result.head,
          ...(result.text === undefined ? {} : { text: result.text }),
        });
        return;
      }
      answer(200, {
        outcome: result.outcome,
        commit: result.commit,
        loaded: options.revisions.latest()?.commit === result.commit,
      });
    })().catch((error) => {
      const failure = failureAnswer(error);
      if (!res.writableEnded) answer(failure.status, failure.body);
    });
  });
}
