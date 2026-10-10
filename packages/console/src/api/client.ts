// ---
// relationships:
//   implements: [operator-console, actors-api]
// ---
import { actorsApiPath, isActorsResponse } from "@wyrd-company/manifold-shared/actors-api";
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
import { actorHistoryPath, isActorHistoryResponse } from "@wyrd-company/manifold-shared/actors-api";
import type { ActorHistory } from "@wyrd-company/manifold-shared/actors-api";
import {
  actorUsageApiPath,
  isActorUsageResponse,
} from "@wyrd-company/manifold-shared/actor-usage-api";
import type { ActorUsageResponse } from "@wyrd-company/manifold-shared/actor-usage-api";
export type ActorsResult =
  | { kind: "ok"; actors: readonly ActorSummary[] }
  | { kind: "failed"; message: string };
export function mapActorsResult(status: number, body: unknown): ActorsResult {
  if (status === 200 && isActorsResponse(body)) return { kind: "ok", actors: body.actors };
  return {
    kind: "failed",
    message:
      status === 200
        ? "The service returned an invalid actors response."
        : "Cannot read actors. Try again.",
  };
}
export async function fetchActors(
  status: "active" | "completed" = "active",
): Promise<ActorsResult> {
  try {
    const response = await fetch(
      status === "completed" ? `${actorsApiPath}?status=completed` : actorsApiPath,
    );
    return mapActorsResult(response.status, response.status === 200 ? await response.json() : null);
  } catch {
    return { kind: "failed", message: "Cannot read actors. Check the connection and try again." };
  }
}

export type ActorHistoryResult =
  | { kind: "ok"; history: ActorHistory }
  | { kind: "missing" }
  | { kind: "failed"; message: string };
export type ActorUsageResult =
  | { kind: "ok"; usage: ActorUsageResponse }
  | { kind: "missing" }
  | { kind: "failed"; message: string };
const failedRead = (subject: string) => ({
  kind: "failed" as const,
  message: `Cannot read ${subject}. Check the connection and try again.`,
});
export function mapActorHistoryResult(status: number, body: unknown): ActorHistoryResult {
  return status === 404
    ? { kind: "missing" }
    : status === 200 && isActorHistoryResponse(body)
      ? { kind: "ok", history: body.history }
      : failedRead("actor history");
}
export function mapActorUsageResult(status: number, body: unknown): ActorUsageResult {
  return status === 404
    ? { kind: "missing" }
    : status === 200 && isActorUsageResponse(body)
      ? { kind: "ok", usage: body }
      : failedRead("actor usage");
}
export async function fetchActorHistory(actorId: string): Promise<ActorHistoryResult> {
  try {
    const response = await fetch(actorHistoryPath(actorId));
    return mapActorHistoryResult(
      response.status,
      response.status === 200 ? await response.json() : null,
    );
  } catch {
    return failedRead("actor history");
  }
}
export async function fetchActorUsage(actorId: string): Promise<ActorUsageResult> {
  try {
    const response = await fetch(actorUsageApiPath(actorId));
    return mapActorUsageResult(
      response.status,
      response.status === 200 ? await response.json() : null,
    );
  } catch {
    return failedRead("actor usage");
  }
}
