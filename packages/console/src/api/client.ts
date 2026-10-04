// ---
// relationships:
//   implements: [operator-console, actors-api]
// ---
import { actorsApiPath, isActorsResponse } from "@wyrd-company/manifold-shared/actors-api";
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
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
export async function fetchActors(): Promise<ActorsResult> {
  try {
    const response = await fetch(actorsApiPath);
    return mapActorsResult(response.status, response.status === 200 ? await response.json() : null);
  } catch {
    return { kind: "failed", message: "Cannot read actors. Check the connection and try again." };
  }
}
