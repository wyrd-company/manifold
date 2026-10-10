// ---
// relationships:
//   implements: operator-console
// ---
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
export interface ActorsSearch {
  status?: "completed";
  item?: string;
  blueprint?: string;
  environment?: string;
  account?: string;
}
export function actorsSearch(search: Record<string, unknown>): ActorsSearch {
  return {
    ...(search["status"] === "completed" ? { status: "completed" as const } : {}),
    ...Object.fromEntries(
      ["item", "blueprint", "environment", "account"]
        .filter((k) => typeof search[k] === "string" && search[k] !== "")
        .map((k) => [k, search[k]]),
    ),
  };
}
export function filterActors<T extends { actor: ActorSummary; accounts: readonly string[] }>(
  rows: readonly T[],
  search: ActorsSearch,
): T[] {
  return rows.filter(
    ({ actor, accounts }) =>
      (!search.item || actor.portfolioItem === search.item) &&
      (!search.blueprint || (actor.blueprint?.path ?? actor.machine) === search.blueprint) &&
      (!search.environment || actor.environment === search.environment) &&
      (!search.account || accounts.includes(search.account)),
  );
}
