// ---
// relationships:
//   implements: escalation-contract
// ---
import type { IncomingMessage, ServerResponse, RequestListener } from "node:http";
import type { EscalationRows } from "./rows.ts";
import type { AnswerOutcome, Escalation, EscalationAnswer, EscalationChannel } from "./types.ts";
const escape = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
function page(escalation: Escalation, key: string) {
  const title = escape(escalation.title);
  const answerValue = escalation.answer?.value;
  const answerText =
    answerValue &&
    ("text" in answerValue
      ? answerValue.text
      : escalation.choices.find((c) => c.id === answerValue.choice)?.label);
  const form =
    escalation.status === "open"
      ? `<form method="post" action="${escalation.id}/answer"><input type="hidden" name="key" value="${escape(key)}">${escalation.choices.map((c) => `<button name="choice" value="${escape(c.id)}">${escape(c.label)}</button>`).join("")}</form>${escalation.freeText ? `<form method="post" action="${escalation.id}/answer"><input type="hidden" name="key" value="${escape(key)}"><textarea name="text" required></textarea><button>Answer</button></form>` : ""}`
      : `<p>${escape(escalation.status === "withdrawn" ? "Withdrawn" : `Answered: ${answerText} (${escalation.answer?.channel})`)}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head><body><h1>${title}</h1><pre style="white-space:pre-wrap">${escape(escalation.question)}</pre>${form}</body></html>`;
}
class BodyError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("Invalid request body");
    this.status = status;
  }
}
async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk as Uint8Array);
    bytes += buffer.length;
    if (bytes > 65536) throw new BodyError(413);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export function escalationListeners(
  rows: EscalationRows,
  answer: (id: string, value: EscalationAnswer, channel: EscalationChannel) => AnswerOutcome,
) {
  function listener(api: boolean): RequestListener {
    return (request, response) => {
      void serve(request, response, api).catch((error) => {
        if (error instanceof BodyError)
          reply(response, error.status, { error: error.message }, api);
        else {
          reply(response, 500, { error: "Unavailable" }, api);
        }
      });
    };
  }
  function reply(response: ServerResponse, status: number, value: unknown, api: boolean) {
    response.statusCode = status;
    response.setHeader(
      "Content-Type",
      api ? "application/json; charset=utf-8" : "text/html; charset=utf-8",
    );
    response.end(
      api
        ? JSON.stringify(value)
        : typeof value === "string"
          ? value
          : escape((value as { error: string }).error),
    );
  }
  async function serve(request: IncomingMessage, response: ServerResponse, api: boolean) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    );
    const url = new URL(request.url ?? "/", "http://localhost");
    const prefix = api ? "/api/escalations" : "/escalations";
    const match = new RegExp("^" + prefix + "/([A-Za-z0-9_-]{22})(/answer)?$").exec(url.pathname);
    if (!api && match?.[2]) response.setHeader("Access-Control-Allow-Origin", "*");
    if (api && url.pathname === prefix && request.method === "GET") {
      const status = url.searchParams.get("status");
      if (status !== null && !["open", "answered", "withdrawn"].includes(status)) {
        reply(response, 400, { error: "Invalid status" }, true);
        return;
      }
      reply(
        response,
        200,
        { escalations: rows.list(status as Escalation["status"] | undefined) },
        true,
      );
      return;
    }
    if (!match) {
      reply(response, 404, { error: "Not found" }, api);
      return;
    }
    const id = match[1]!;
    const isAnswer = Boolean(match[2]);
    if (request.method !== (isAnswer ? "POST" : "GET")) {
      response.setHeader("Allow", isAnswer ? "POST" : "GET");
      reply(response, 405, { error: "Method not allowed" }, api);
      return;
    }
    let key = url.searchParams.get("key") ?? "";
    let value: unknown;
    if (isAnswer) {
      const contentType = request.headers["content-type"]?.split(";")[0];
      if (contentType !== (api ? "application/json" : "application/x-www-form-urlencoded")) {
        reply(response, 400, { error: "Invalid content type" }, api);
        return;
      }
      const raw = await body(request);
      if (api) {
        try {
          value = JSON.parse(raw);
        } catch {
          reply(response, 400, { error: "Invalid JSON" }, true);
          return;
        }
      } else {
        const fields = new URLSearchParams(raw);
        key = fields.get("key") ?? "";
        value = Object.fromEntries([...fields].filter(([name]) => name !== "key"));
        if ([...fields.keys()].some((name) => fields.getAll(name).length !== 1)) value = null;
      }
    }
    if (!api && !rows.keyMatches(id, key)) {
      reply(response, 404, { error: "Not found" }, false);
      return;
    }
    const escalation = rows.get(id);
    if (!escalation) {
      reply(response, 404, { error: "Not found" }, api);
      return;
    }
    if (!isAnswer) {
      reply(response, 200, api ? escalation : page(escalation, key), api);
      return;
    }
    const result = answer(id, value as EscalationAnswer, api ? "api" : "link");
    if (result.status === "invalid") {
      reply(response, 400, { error: result.reason }, api);
      return;
    }
    if (result.status === "not-found") {
      reply(response, 404, { error: "Not found" }, api);
      return;
    }
    reply(
      response,
      200,
      api
        ? { outcome: result.status, escalation: result.escalation }
        : page(result.escalation, key),
      api,
    );
  }
  return { requestListener: listener(false), apiListener: listener(true) };
}
