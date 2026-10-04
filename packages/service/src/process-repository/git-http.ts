// ---
// relationships:
//   implements: process-repository
// ---
import http from "isomorphic-git/http/web";
import type { HttpClient } from "isomorphic-git";
export function gitHttp(signal: AbortSignal): HttpClient {
  return { request: (options) => http.request({ ...options, signal }) };
}
