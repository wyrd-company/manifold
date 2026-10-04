// ---
// relationships:
//   implements: escalations
//   references: service-assembly
// ---
import type { ServiceHttp } from "../service/index.ts";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import type { Escalations } from "./types.ts";
export function mountEscalations(http: ServiceHttp, escalations: Escalations): void {
  http.mount("/escalations", escalations.requestListener);
  http.mount("/api/escalations", escalations.apiListener);
}
export function escalationImplementations(escalations: Escalations): ImplementationRegistry {
  return { actors: { escalate: escalations.escalate }, actions: {}, guards: {}, delays: {} };
}
