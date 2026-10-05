// ---
// relationships:
//   implements: github-source-database-schema
// ---
import type { StoreConnection } from "../store/index.ts";
import type { CardMove } from "./types.ts";
export function moveRecords(connection: StoreConnection) {
  const db = connection.database;
  const keys = (move: CardMove) => [move.actorId, move.invokeId, move.entryId] as const;
  return {
    sent(move: CardMove, item: string, field: string, option: string) {
      const existing = db
        .prepare(
          "SELECT 1 FROM github_card_move WHERE actor_id=? AND invoke_id=? AND entry_id=? AND field_node_id=? AND option_id=?",
        )
        .get(...keys(move), field, option);
      if (existing) return false;
      db.prepare(
        "INSERT INTO github_card_move (actor_id, invoke_id, entry_id, item_node_id, field_node_id, option_id, state, sequence) VALUES (?, ?, ?, ?, ?, ?, 'sent', (SELECT coalesce(max(sequence), 0)+1 FROM github_card_move))",
      ).run(...keys(move), item, field, option);
      return true;
    },
    confirmed(move: CardMove, field: string, option: string) {
      db.prepare(
        "UPDATE github_card_move SET state='confirmed' WHERE actor_id=? AND invoke_id=? AND entry_id=? AND field_node_id=? AND option_id=?",
      ).run(...keys(move), field, option);
    },
    refused(move: CardMove, field: string, option: string) {
      db.prepare(
        "DELETE FROM github_card_move WHERE actor_id=? AND invoke_id=? AND entry_id=? AND field_node_id=? AND option_id=?",
      ).run(...keys(move), field, option);
    },
    removed(item: string) {
      db.prepare("DELETE FROM github_card_move WHERE item_node_id=?").run(item);
    },
    attribute(item: string, field: string, option: string | undefined) {
      const row =
        option === undefined
          ? undefined
          : db
              .prepare(
                "SELECT * FROM github_card_move WHERE item_node_id=? AND field_node_id=? AND option_id=? ORDER BY sequence DESC LIMIT 1",
              )
              .get(item, field, option);
      if (!row) {
        db.prepare(
          "UPDATE github_card_move SET state='doubtful' WHERE item_node_id=? AND field_node_id=?",
        ).run(item, field);
        return null;
      }
      db.prepare(
        "DELETE FROM github_card_move WHERE item_node_id=? AND field_node_id=? AND sequence<=?",
      ).run(item, field, row["sequence"] as number);
      return { actorId: row["actor_id"] as string, confirmed: row["state"] === "confirmed" };
    },
  };
}
