// ---
// relationships:
//   implements: retention
// ---
import { storedText } from "../store/index.ts";
import type { StoreConnection } from "../store/index.ts";
export function pruneDeliveries(
  connection: StoreConnection,
  query: { receivedBefore: number; limit: number },
) {
  return connection.transaction(() =>
    Number(
      connection.database
        .prepare(`
    DELETE FROM github_delivery WHERE delivery_id IN (
      SELECT delivery_id FROM github_delivery d WHERE received_at < ?
      AND NOT EXISTS (SELECT 1 FROM github_hook_scan s WHERE s.hook_id=d.hook_id AND s.scanned_through<=d.received_at)
      ORDER BY received_at, delivery_id LIMIT ?
    )`)
        .run(query.receivedBefore, query.limit).changes,
    ),
  );
}
export function pruneRedeliveries(
  connection: StoreConnection,
  query: { requestedBefore: number; limit: number },
) {
  return connection.transaction(() =>
    Number(
      connection.database
        .prepare(`
    DELETE FROM github_redelivery WHERE delivery_id IN (
      SELECT delivery_id FROM github_redelivery d WHERE requested_at < ?
      AND NOT EXISTS (SELECT 1 FROM github_hook_scan s WHERE s.hook_id=d.hook_id AND s.scanned_through<=d.requested_at)
      ORDER BY requested_at, delivery_id LIMIT ?
    )`)
        .run(query.requestedBefore, query.limit).changes,
    ),
  );
}
export function cardMoveActors(
  connection: StoreConnection,
  query: { after?: string; limit: number },
): string[] {
  return connection.database
    .prepare(
      "SELECT DISTINCT CAST(actor_id AS BLOB) AS actor_id FROM github_card_move WHERE actor_id>? ORDER BY actor_id LIMIT ?",
    )
    .all(query.after ?? "", query.limit)
    .map((row) => storedText(row["actor_id"]!));
}
export function pruneCardMoves(connection: StoreConnection, actorIds: readonly string[]) {
  if (!actorIds.length) return 0;
  return connection.transaction(() =>
    Number(
      connection.database
        .prepare(
          `DELETE FROM github_card_move WHERE actor_id IN (${actorIds.map(() => "?").join(",")})`,
        )
        .run(...actorIds).changes,
    ),
  );
}
