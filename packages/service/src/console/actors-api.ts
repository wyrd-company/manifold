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
export function leaves(value: StateValue, prefix = ""): string[] {
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
        status: snapshot.status as ActorSummary["status"],
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
    const requested = request.url ?? "/";
    const delimiter = requested.indexOf("?");
    const pathname = delimiter === -1 ? requested : requested.slice(0, delimiter);
    const query = delimiter === -1 ? "" : requested.slice(delimiter + 1);
    const match = /^\/api\/actors\/([^/]+)\/history$/.exec(pathname);
    if (pathname !== actorsApiPath && !match) {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    response.setHeader("Cache-Control", "no-store");
    try {
      if (match) {
        let actorId: string;
        try {
          actorId = decodeURIComponent(match[1]!);
        } catch {
          response.writeHead(404).end();
          return;
        }
        const history = options.history.read(actorId);
        if (!history) {
          response.writeHead(404).end();
          return;
        }
        response
          .writeHead(200, { "Content-Type": "application/json" })
          .end(JSON.stringify({ history }));
        return;
      }
      const statuses = new URLSearchParams(query).getAll("status");
      if (
        statuses.length > 1 ||
        (statuses.length === 1 && !["active", "completed"].includes(statuses[0]!))
      ) {
        response.writeHead(400).end();
        return;
      }
      const actors = actorSummaries(
        statuses[0] === "completed"
          ? options.store.endedSnapshots()
          : options.store.activeSnapshots(),
      );
      response
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ actors }));
    } catch (error) {
      (options.log ?? ((entry) => console.error(JSON.stringify(entry))))({
        level: "error",
        path: pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      response.writeHead(500).end();
    }
  };
}
