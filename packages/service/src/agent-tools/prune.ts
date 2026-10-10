// ---
// relationships:
//   implements: retention
// ---
import type { StoreConnection } from "../store/index.ts";
export interface PrunableMessage {
  readonly sequence: number;
  readonly senderActorId: string;
  readonly readerActorId: string;
}
export function pruneAnswer(
  connection: StoreConnection,
  escalationId: string,
): { answers: number } | "kept" {
  return connection.transaction(() => {
    if (
      connection.database
        .prepare(
          "SELECT 1 FROM agenttool_answer WHERE escalation_id=? AND (status='pending' OR placed_at IS NULL)",
        )
        .get(escalationId)
    )
      return "kept";
    const answers = Number(
      connection.database
        .prepare(
          "DELETE FROM agenttool_answer WHERE escalation_id=? AND status!='pending' AND placed_at IS NOT NULL",
        )
        .run(escalationId).changes,
    );
    return { answers };
  });
}
export function prunableMessages(
  connection: StoreConnection,
  query: { readBefore: number; after?: number; limit: number },
): PrunableMessage[] {
  return connection.database
    .prepare(
      "SELECT sequence,sender_actor_id,delivered_to FROM agenttool_message WHERE read_at<? AND sequence>? ORDER BY sequence LIMIT ?",
    )
    .all(query.readBefore, query.after ?? 0, query.limit)
    .map((row) => ({
      sequence: Number(row["sequence"]),
      senderActorId: String(row["sender_actor_id"]),
      readerActorId: String(row["delivered_to"]),
    }));
}
export function pruneMessages(connection: StoreConnection, sequences: readonly number[]) {
  if (!sequences.length) return 0;
  return connection.transaction(() =>
    Number(
      connection.database
        .prepare(
          `DELETE FROM agenttool_message WHERE read_at IS NOT NULL AND sequence IN (${sequences.map(() => "?").join(",")})`,
        )
        .run(...sequences).changes,
    ),
  );
}
