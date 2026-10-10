// ---
// relationships:
//   implements: t3code-environment-source
//   realizes: t3code-source-database-schema
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import type { Store } from "../store/index.ts";
import type { CreatedProject, CreatedProjectRecord } from "./types.ts";
export function createdProjects(store: Store) {
  const db = store.connection.database;
  const insert = db.prepare(
    "INSERT INTO t3_created_project (environment, project_id, actor_id, item, presence) VALUES (?, ?, ?, ?, ?) ON CONFLICT (environment, project_id) DO NOTHING",
  );
  const select = db.prepare(
    "SELECT CAST(environment AS BLOB) AS environment, CAST(project_id AS BLOB) AS projectId, CAST(actor_id AS BLOB) AS actorId, CAST(item AS BLOB) AS item FROM t3_created_project WHERE environment = ? AND project_id = ?",
  );
  const update = db.prepare(
    "UPDATE t3_created_project SET presence = ? WHERE environment = ? AND project_id = ? AND presence != 'removed'",
  );
  const all =
    db.prepare(`SELECT CAST(c.environment AS BLOB) AS environment, CAST(c.project_id AS BLOB) AS projectId, CAST(c.actor_id AS BLOB) AS actorId, CAST(c.item AS BLOB) AS item, c.presence,
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
      for (const record of all
        .all()
        .map(readT3CreatedProject) as unknown as CreatedProjectRecord[]) {
        if (record.environment !== environment) continue;
        if (live.has(record.projectId)) presence(environment, record.projectId, "listed");
        else if (record.presence === "listed" || removed.has(record.projectId))
          presence(environment, record.projectId, "removed");
      }
    },
    all() {
      return (
        all.all().map(readT3CreatedProject) as unknown as Omit<CreatedProjectRecord, "retirable">[]
      ).map((row) => ({
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
      return readT3CreatedProject(select.get(environment, projectId)) as unknown as
        | CreatedProject
        | undefined;
    },
  };
}

function readT3CreatedProject<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    environment: storedText(values["environment"]!),
    projectId: storedText(values["projectId"]!),
    actorId: storedText(values["actorId"]!),
    item: storedText(values["item"]!),
  } as T;
}
