// ---
// relationships:
//   implements: [blueprints-api, operator-console]
// ---
import type { IncomingHttpHeaders } from "node:http";
import type { SaveRequest } from "../process-repository/index.ts";
import type { LintBlueprintRequest } from "@wyrd-company/manifold-shared/blueprints-api";
export const validPath = (path: unknown): path is string =>
  typeof path === "string" &&
  path.startsWith("blueprints/") &&
  /\.ya?ml$/.test(path) &&
  !path.includes("\\") &&
  path.split("/").every((s) => s !== "" && s !== "." && s !== "..");
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
export function saveRequest(value: unknown): value is SaveRequest {
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
export function sameSite(headers: IncomingHttpHeaders) {
  if (headers["sec-fetch-site"] === "cross-site") return false;
  const origin = headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const matches = (authority: string | string[] | undefined) =>
      typeof authority === "string" &&
      /^[^/?#@]+$/.test(authority) &&
      new URL(`${parsed.protocol}//${authority}`).host === parsed.host;
    return matches(headers.host) || matches(headers["x-forwarded-host"]);
  } catch {
    return false;
  }
}
export function textRequest(value: unknown): value is LintBlueprintRequest {
  return record(value) && validPath(value["path"]) && typeof value["text"] === "string";
}
export function lintRequest(value: LintBlueprintRequest) {
  return Object.keys(value).every((key) => key === "path" || key === "text");
}
export function jsonContent(headers: IncomingHttpHeaders) {
  return headers["content-type"]?.split(";")[0]?.trim().toLowerCase() === "application/json";
}
