// ---
// relationships:
//   implements: intake-records-table
// ---
import type { Store } from "../store/index.ts";
import type { IntakeRecord, IntakeStartFailure } from "./types.ts";
const columns = [
  "issue_node_id",
  "status",
  "commit_id",
  "binding",
  "project_node_id",
  "project_owner",
  "project_number",
  "environment",
  "blueprint_path",
  "blueprint_version",
  "portfolio_item",
  "portfolio_commit",
  "actor_id",
  "failure",
  "evaluation",
  "attempts",
  "start_failure",
  "start_attempts",
  "created_at",
  "updated_at",
];
export function records(store: Store) {
  const db = store.connection.database;
  const decode = (row: Record<string, unknown>): IntakeRecord => ({
    issueNodeId: row["issue_node_id"] as string,
    status: row["status"] as IntakeRecord["status"],
    commit: row["commit_id"] as string,
    binding: row["binding"] as string | null,
    project:
      row["project_node_id"] === null
        ? null
        : {
            nodeId: row["project_node_id"] as string,
            owner: row["project_owner"] as string,
            number: row["project_number"] as number,
          },
    environment: row["environment"] as string | null,
    blueprintPath: row["blueprint_path"] as string | null,
    blueprintVersion: row["blueprint_version"] as string | null,
    portfolioItem: row["portfolio_item"] as string | null,
    portfolioCommit: row["portfolio_commit"] as string | null,
    actorId: row["actor_id"] as string,
    failure:
      row["failure"] === null
        ? null
        : (JSON.parse(row["failure"] as string) as IntakeRecord["failure"]),
    evaluation:
      row["evaluation"] === null
        ? null
        : (JSON.parse(row["evaluation"] as string) as IntakeRecord["evaluation"]),
    attempts: row["attempts"] as number,
    startFailure:
      row["start_failure"] === null
        ? null
        : (JSON.parse(row["start_failure"] as string) as IntakeRecord["startFailure"]),
    startAttempts: row["start_attempts"] as number,
    createdAt: row["created_at"] as number,
    updatedAt: row["updated_at"] as number,
  });
  return {
    get(id: string) {
      const row = db.prepare("SELECT * FROM intake_record WHERE issue_node_id=?").get(id);
      return row ? decode(row) : undefined;
    },
    pending() {
      return db
        .prepare("SELECT issue_node_id FROM intake_record WHERE status='recorded'")
        .all()
        .map((r) => r["issue_node_id"] as string);
    },
    decide(r: IntakeRecord) {
      store.connection.transaction(() =>
        db
          .prepare(
            `INSERT INTO intake_record (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")}) ON CONFLICT(issue_node_id) DO UPDATE SET ${columns
              .slice(1)
              .map((c) => `${c}=excluded.${c}`)
              .join(",")} WHERE intake_record.status='failed'`,
          )
          .run(
            r.issueNodeId,
            r.status,
            r.commit,
            r.binding,
            r.project?.nodeId ?? null,
            r.project?.owner ?? null,
            r.project?.number ?? null,
            r.environment,
            r.blueprintPath,
            r.blueprintVersion,
            r.portfolioItem,
            r.portfolioCommit,
            r.actorId,
            r.failure === null ? null : JSON.stringify(r.failure),
            r.evaluation === null ? null : JSON.stringify(r.evaluation),
            r.attempts,
            null,
            0,
            r.createdAt,
            r.updatedAt,
          ),
      );
    },
    failedStart(id: string, failure: IntakeStartFailure) {
      store.connection.transaction(() =>
        db
          .prepare(
            "UPDATE intake_record SET start_failure=?, start_attempts=start_attempts+1, updated_at=? WHERE issue_node_id=? AND status='recorded'",
          )
          .run(JSON.stringify(failure), Date.now(), id),
      );
    },
    started(id: string) {
      store.connection.transaction(() =>
        db
          .prepare(
            "UPDATE intake_record SET status='started', start_failure=NULL, updated_at=? WHERE issue_node_id=? AND status='recorded'",
          )
          .run(Date.now(), id),
      );
    },
  };
}
