// ---
// relationships:
//   implements: durable-event-delivery
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import type { StoreConnection } from "../store/index.ts";
export function sourceEventSources(connection: StoreConnection): string[] {
  return connection.database
    .prepare(
      "SELECT DISTINCT CAST(source AS BLOB) AS source FROM router_source_event ORDER BY source",
    )
    .all()
    .map(readRouterSourceEvent)
    .map((row) => String(row["source"]));
}
export function pruneSourceEvents(
  connection: StoreConnection,
  request: { readonly source: string; readonly acceptedBefore: number; readonly limit: number },
): number {
  return connection.transaction(() =>
    Number(
      connection.database
        .prepare(
          "DELETE FROM router_source_event WHERE (source,event_id) IN (SELECT source,event_id FROM router_source_event WHERE source=? AND accepted_at < ? ORDER BY accepted_at,event_id LIMIT ?)",
        )
        .run(request.source, request.acceptedBefore, request.limit).changes,
    ),
  );
}

function readRouterSourceEvent<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, source: storedText(values["source"]!) } as T;
}
