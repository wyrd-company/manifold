// ---
// relationships:
//   implements: actors-api
// ---
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import { actorsApiPath } from "@wyrd-company/manifold-shared/actors-api";
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
import type { StateValue, StoredSnapshot } from "../store/index.ts";
import type { ConsoleOptions, RequestListener } from "./index.ts";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
function leaves(value: StateValue, prefix = ""): string[] {
  if (typeof value === "string") return [prefix ? `${prefix}.${value}` : value];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, prefix ? `${prefix}.${key}` : key),
  );
}
export function actorSummaries(snapshots: readonly StoredSnapshot[]): ActorSummary[] {
  return snapshots
    .toSorted(
      (a, b) =>
        b.savedAt - a.savedAt || (a.actorId < b.actorId ? -1 : a.actorId > b.actorId ? 1 : 0),
    )
    .map(({ actorId, machine, snapshot, savedAt }) => {
      const context = snapshot["context"];
      const identity = record(context) && record(context["manifold"]) ? context["manifold"] : {};
      const blueprint = parseBlueprintVersionKey(machine);
      const fields = Object.fromEntries(
        ["environment", "project", "issue", "portfolioItem"].flatMap((key) =>
          typeof identity[key] === "string" ? [[key, identity[key]]] : [],
        ),
      );
      return {
        actorId,
        machine,
        ...(blueprint ? { blueprint: { path: blueprint.path, commit: blueprint.commit } } : {}),
        states: snapshot.status === "error" ? [] : leaves(snapshot.value),
        ...fields,
        savedAt: new Date(savedAt).toISOString(),
      };
    });
}
export function actorsListener(options: ConsoleOptions): RequestListener {
  return (request, response) => {
    if (request.url?.split("?")[0] !== actorsApiPath) {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    try {
      const actors = actorSummaries(options.store.activeSnapshots());
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ actors }));
    } catch (error) {
      (options.log ?? ((entry) => console.error(JSON.stringify(entry))))({
        level: "error",
        path: actorsApiPath,
        error: error instanceof Error ? error.message : String(error),
      });
      response.writeHead(500).end();
    }
  };
}
