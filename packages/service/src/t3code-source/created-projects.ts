// ---
// relationships:
//   implements: t3code-environment-source
//   realizes: t3code-source-database-schema
// ---
import type { Store } from "../store/index.ts";
import type { CreatedProject } from "./types.ts";
export function createdProjects(store: Store) {
  const db = store.connection.database;
  const insert = db.prepare(
    "INSERT INTO t3_created_project (environment, project_id, actor_id, item) VALUES (?, ?, ?, ?) ON CONFLICT (environment, project_id) DO NOTHING",
  );
  const select = db.prepare(
    "SELECT environment, project_id AS projectId, actor_id AS actorId, item FROM t3_created_project WHERE environment = ? AND project_id = ?",
  );
  return {
    record(record: CreatedProject) {
      store.connection.transaction(() =>
        insert.run(record.environment, record.projectId, record.actorId, record.item),
      );
    },
    read(environment: string, projectId: string) {
      return select.get(environment, projectId) as unknown as CreatedProject | undefined;
    },
  };
}
