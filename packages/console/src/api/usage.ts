// ---
// relationships:
//   implements: [usage-api, operator-console]
// ---
import {
  isUsageMoveResponse,
  isUsageUnownedResponse,
  usageMovesPath,
  usageUnownedPath,
} from "@wyrd-company/manifold-shared/usage-api";
import type {
  UsageMoveRequest,
  UsageMoveResponse,
  UsageUnownedResponse,
} from "@wyrd-company/manifold-shared/usage-api";
type Failed = { kind: "failed"; message: string };
export type MoveResult =
  | { kind: "ok"; body: UsageMoveResponse }
  | { kind: "refused"; error: "unknown-actor" | "invalid-target"; message: string }
  | Failed;
export type UnownedResult = { kind: "ok"; body: UsageUnownedResponse } | Failed;
const failed = (): Failed => ({
  kind: "failed",
  message: "Cannot read or move usage. Check the connection and try again.",
});
export function mapMoveResult(status: number, body: unknown): MoveResult {
  if (status === 200 && isUsageMoveResponse(body)) return { kind: "ok", body };
  if (
    status === 422 &&
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    (body.error === "unknown-actor" || body.error === "invalid-target") &&
    "message" in body &&
    typeof body.message === "string"
  )
    return { kind: "refused", error: body.error, message: body.message };
  return failed();
}
export function mapUnownedResult(status: number, body: unknown): UnownedResult {
  return status === 200 && isUsageUnownedResponse(body) ? { kind: "ok", body } : failed();
}
export async function fetchUnownedUsage(): Promise<UnownedResult> {
  try {
    const response = await fetch(usageUnownedPath);
    return mapUnownedResult(response.status, await response.json());
  } catch {
    return failed();
  }
}
export async function moveUsage(request: UsageMoveRequest): Promise<MoveResult> {
  try {
    const response = await fetch(usageMovesPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return mapMoveResult(response.status, await response.json());
  } catch {
    return failed();
  }
}
