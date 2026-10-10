// ---
// relationships:
//   implements: [blueprints-api, declarations-api]
// ---
import type { IncomingHttpHeaders } from "node:http";
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
export function jsonContent(headers: IncomingHttpHeaders) {
  return headers["content-type"]?.split(";")[0]?.trim().toLowerCase() === "application/json";
}
