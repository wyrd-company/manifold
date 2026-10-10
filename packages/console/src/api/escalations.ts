// ---
// relationships:
//   implements: [operator-console, escalation-contract]
// ---
import {
  escalationsApiPath,
  isEscalationsResponse,
} from "@wyrd-company/manifold-shared/escalations-api";
import type { Escalation } from "@wyrd-company/manifold-shared/escalations-api";
export type EscalationsResult =
  | { kind: "ok"; escalations: readonly Escalation[] }
  | { kind: "failed"; message: string };
export function mapEscalationsResult(status: number, body: unknown): EscalationsResult {
  return status === 200 && isEscalationsResponse(body)
    ? { kind: "ok", escalations: body.escalations }
    : { kind: "failed", message: "Cannot read escalations. Check the connection and try again." };
}
export async function fetchEscalations(status: Escalation["status"]): Promise<EscalationsResult> {
  try {
    const response = await fetch(`${escalationsApiPath}?status=${status}`);
    return mapEscalationsResult(
      response.status,
      response.status === 200 ? await response.json() : null,
    );
  } catch {
    return mapEscalationsResult(0, undefined);
  }
}
