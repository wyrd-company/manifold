// ---
// relationships:
//   implements: retention
// ---
import type { StoreConnection } from "../store/index.ts";
export interface CreatedProjectKey {
  readonly environment: string;
  readonly projectId: string;
}
export interface RetirableCreatedProject extends CreatedProjectKey {
  readonly actorId: string;
}
const retirable = `presence='removed' AND NOT EXISTS (
  SELECT 1 FROM t3_thread t WHERE t.environment=t3_created_project.environment AND t.project_id=t3_created_project.project_id
)`;
export function retirableCreatedProjects(
  connection: StoreConnection,
  query: { environments: readonly string[]; after?: CreatedProjectKey; limit: number },
): RetirableCreatedProject[] {
  if (!query.environments.length) return [];
  return connection.database
    .prepare(`SELECT environment,project_id,actor_id FROM t3_created_project
    WHERE ${retirable} AND environment IN (${query.environments.map(() => "?").join(",")})
    AND (environment,project_id)>(?,?) ORDER BY environment,project_id LIMIT ?`)
    .all(
      ...query.environments,
      query.after?.environment ?? "",
      query.after?.projectId ?? "",
      query.limit,
    )
    .map((row) => ({
      environment: String(row["environment"]),
      projectId: String(row["project_id"]),
      actorId: String(row["actor_id"]),
    }));
}
export function retireCreatedProject(
  connection: StoreConnection,
  key: CreatedProjectKey,
  query: { environments: readonly string[] },
): "retired" | "kept" {
  if (!query.environments.length) return "kept";
  return connection.transaction(() =>
    connection.database
      .prepare(`DELETE FROM t3_created_project
    WHERE environment=? AND project_id=? AND environment IN (${query.environments.map(() => "?").join(",")}) AND ${retirable}`)
      .run(key.environment, key.projectId, ...query.environments).changes
      ? "retired"
      : "kept",
  );
}
