// ---
// relationships:
//   implements: environments-api
// ---
import type { HttpListener } from "../http-host/index.ts";
import type { EnvironmentSummary } from "@wyrd-company/manifold-shared/environments-api";
import type { EnvironmentAction } from "./types.ts";
export function listener(
  configurationFile: string,
  names: readonly string[],
  summary: (name: string) => EnvironmentSummary,
  act: (name: string, action: EnvironmentAction) => unknown,
): HttpListener {
  return (request, response) => {
    const answer = (code: number, value: unknown) => {
      response.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(value));
    };
    const error = (code: number, kind: string, message: string) =>
      answer(code, { error: { kind, message } });
    const path = new URL(request.url ?? "/", "http://example.test").pathname;
    if (path === "/api/environments") {
      if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        error(405, "method-not-allowed", "Expected GET.");
        return;
      }
      answer(200, { configurationFile, environments: names.map(summary) });
      return;
    }
    const match = /^\/api\/environments\/([^/]+)\/([^/]+)$/.exec(path);
    if (!match) {
      error(404, "not-found", "Unknown environments endpoint.");
      return;
    }
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      error(405, "method-not-allowed", "Expected POST.");
      return;
    }
    let name: string, action: string;
    try {
      name = decodeURIComponent(match[1]!);
      action = decodeURIComponent(match[2]!);
    } catch {
      error(404, "not-found", "Invalid environment path.");
      return;
    }
    if (!names.includes(name)) {
      error(404, "unknown-environment", "Environment is not configured.");
      return;
    }
    if (
      action !== "pause" &&
      action !== "resume" &&
      action !== "disconnect" &&
      action !== "reconnect"
    ) {
      error(404, "unknown-action", "Unknown environment action.");
      return;
    }
    try {
      act(name, action);
      answer(200, summary(name));
    } catch (failure) {
      error(500, "action-failed", failure instanceof Error ? failure.message : String(failure));
    }
  };
}
