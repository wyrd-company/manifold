// ---
// relationships:
//   implements: retention
// ---
import { storedText } from "../store/index.ts";
import type { StoreConnection } from "../store/index.ts";
export interface PrunableEscalation {
  readonly escalationId: string;
  readonly actorId?: string;
  readonly latestOccurrence: boolean;
}
const settled = `status IN ('answered','withdrawn')
  AND (kind IS NULL OR status='withdrawn' OR handled_at IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM escalation_notification n WHERE n.escalation_id=escalation.escalation_id AND n.status='pending')`;
export function prunableEscalations(
  connection: StoreConnection,
  query: { closedBefore: number; after?: string; limit: number },
): PrunableEscalation[] {
  return connection.database
    .prepare(`SELECT CAST(escalation_id AS BLOB) AS escalation_id, CAST(coalesce(actor_id,json_extract(subject,'$.actorId')) AS BLOB) AS actor,
    kind IS NOT NULL AND NOT EXISTS (SELECT 1 FROM escalation newer WHERE newer.kind=escalation.kind AND newer.subject=escalation.subject AND newer.occurrence>escalation.occurrence) AS latest
    FROM escalation WHERE ${settled} AND closed_at<? AND escalation_id>? ORDER BY escalation_id LIMIT ?`)
    .all(query.closedBefore, query.after ?? "", query.limit)
    .map((row) => ({
      escalationId: storedText(row["escalation_id"]!),
      ...(row["actor"] === null ? {} : { actorId: storedText(row["actor"]!) }),
      latestOccurrence: row["latest"] === 1,
    }));
}
export function pruneEscalation(
  connection: StoreConnection,
  escalationId: string,
): { notifications: number } | "kept" {
  return connection.transaction(() => {
    if (
      !connection.database
        .prepare(`SELECT 1 FROM escalation WHERE escalation_id=? AND ${settled}`)
        .get(escalationId)
    )
      return "kept";
    const notifications = Number(
      connection.database
        .prepare("DELETE FROM escalation_notification WHERE escalation_id=?")
        .run(escalationId).changes,
    );
    connection.database
      .prepare(`DELETE FROM escalation WHERE escalation_id=? AND ${settled}`)
      .run(escalationId);
    return { notifications };
  });
}
