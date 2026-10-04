// ---
// relationships:
//   implements: actors-api
// ---
export const actorsApiPath = "/api/actors";
export interface ActorSummary {
  readonly actorId: string;
  readonly machine: string;
  readonly blueprint?: { readonly path: string; readonly commit: string };
  readonly states: readonly string[];
  readonly environment?: string;
  readonly project?: string;
  readonly issue?: string;
  readonly portfolioItem?: string;
  readonly savedAt: string;
}
export interface ActorsResponse {
  readonly actors: readonly ActorSummary[];
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
export function isActorsResponse(value: unknown): value is ActorsResponse {
  return (
    record(value) &&
    Object.keys(value).length === 1 &&
    Array.isArray(value["actors"]) &&
    value["actors"].every((actor) => {
      if (
        !record(actor) ||
        !nonempty(actor["actorId"]) ||
        !nonempty(actor["machine"]) ||
        !Array.isArray(actor["states"]) ||
        !actor["states"].every(nonempty) ||
        typeof actor["savedAt"] !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(actor["savedAt"]) ||
        !Number.isFinite(Date.parse(actor["savedAt"])) ||
        new Date(actor["savedAt"]).toISOString() !== actor["savedAt"]
      )
        return false;
      if (
        Object.keys(actor).some(
          (key) =>
            ![
              "actorId",
              "machine",
              "blueprint",
              "states",
              "environment",
              "project",
              "issue",
              "portfolioItem",
              "savedAt",
            ].includes(key),
        )
      )
        return false;
      if (
        ["environment", "project", "issue", "portfolioItem"].some(
          (key) => key in actor && typeof actor[key] !== "string",
        )
      )
        return false;
      const blueprint = actor["blueprint"];
      return (
        !("blueprint" in actor) ||
        (record(blueprint) &&
          Object.keys(blueprint).length === 2 &&
          typeof blueprint["path"] === "string" &&
          /^blueprints\/.+\.ya?ml$/.test(blueprint["path"]) &&
          typeof blueprint["commit"] === "string" &&
          /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(blueprint["commit"]))
      );
    })
  );
}
