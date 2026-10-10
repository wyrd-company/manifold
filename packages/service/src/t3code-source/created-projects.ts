// ---
// relationships:
//   implements: t3code-environment-source
//   realizes: t3code-source-database-schema
// ---
import type { Store } from "../store/index.ts";
import type { CreatedProject, CreatedProjectRecord } from "./types.ts";
export function createdProjects(store: Store) {
  const db = store.connection.database;
  const insert = db.prepare(
    "INSERT INTO t3_created_project (environment, project_id, actor_id, item, presence) VALUES (?, ?, ?, ?, ?) ON CONFLICT (environment, project_id) DO NOTHING",
  );
  const select = db.prepare(
    "SELECT environment, project_id AS projectId, actor_id AS actorId, item FROM t3_created_project WHERE environment = ? AND project_id = ?",
  );
  const update = db.prepare(
    "UPDATE t3_created_project SET presence = ? WHERE environment = ? AND project_id = ? AND presence != 'removed'",
  );
  const all =
    db.prepare(`SELECT c.environment, c.project_id AS projectId, c.actor_id AS actorId, c.item, c.presence,
    (SELECT count(*) FROM t3_thread t WHERE t.environment = c.environment AND t.project_id = c.project_id) AS threads
    FROM t3_created_project c ORDER BY c.environment, c.project_id`);
  function presence(environment: string, project: string, value: "listed" | "removed") {
    update.run(value, environment, project);
  }
  return {
    presence,
    snapshot(environment: string, projects: readonly { id: string; deletedAt?: string | null }[]) {
      const live = new Set(projects.filter((p) => !p.deletedAt).map((p) => p.id));
      const removed = new Set(projects.filter((p) => p.deletedAt).map((p) => p.id));
      for (const record of all.all() as unknown as CreatedProjectRecord[]) {
        if (record.environment !== environment) continue;
        if (live.has(record.projectId)) presence(environment, record.projectId, "listed");
        else if (record.presence === "listed" || removed.has(record.projectId))
          presence(environment, record.projectId, "removed");
      }
    },
    all() {
      return (all.all() as unknown as Omit<CreatedProjectRecord, "retirable">[]).map((row) => ({
        ...row,
        retirable: row.presence === "removed" && row.threads === 0,
      }));
    },
    record(record: CreatedProject, listed = false) {
      store.connection.transaction(() =>
        insert.run(
          record.environment,
          record.projectId,
          record.actorId,
          record.item,
          listed ? "listed" : "unseen",
        ),
      );
    },
    read(environment: string, projectId: string) {
      return select.get(environment, projectId) as unknown as CreatedProject | undefined;
    },
  };
}
