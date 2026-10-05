// ---
// relationships:
//   implements: task-metadata-tables
// ---
import type { TaskMetadataDeclaration, TaskMetadataFinding } from "@wyrd-company/manifold-shared";
import type { AppliedConfiguration } from "./project-types.ts";
import type { StoreConnection } from "../store/index.ts";
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function metadataRecords(connection: StoreConnection) {
  const db = connection.database;
  const latest = () =>
    db.prepare("SELECT declaration FROM metadata_declarations ORDER BY seq DESC LIMIT 1").get()?.[
      "declaration"
    ] as string | undefined;
  return {
    commit: () =>
      db.prepare("SELECT commit_id FROM metadata_declarations ORDER BY seq DESC LIMIT 1").get()?.[
        "commit_id"
      ] as string | undefined,
    applied(
      binding: string,
      project: string,
    ): (AppliedConfiguration & { at: number; commit: string }) | undefined {
      const row = db
        .prepare("SELECT * FROM metadata_project_applies WHERE binding = ? AND project_node_id = ?")
        .get(binding, project);
      return row
        ? {
            fields: JSON.parse(row["fields"] as string),
            owned: JSON.parse(row["owned"] as string),
            at: row["applied_at"] as number,
            commit: row["commit_id"] as string,
          }
        : undefined;
    },
    recordApply(
      binding: string,
      project: string,
      commit: string,
      applied: AppliedConfiguration,
      at: number,
    ) {
      connection.transaction(() => {
        db.prepare(
          "INSERT INTO metadata_project_applies VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (binding, project_node_id) DO UPDATE SET commit_id=excluded.commit_id, fields=excluded.fields, owned=excluded.owned, applied_at=excluded.applied_at",
        ).run(
          binding,
          project,
          commit,
          JSON.stringify(applied.fields),
          JSON.stringify(applied.owned),
          at,
        );
        db.prepare("DELETE FROM metadata_pending_saves WHERE binding = ?").run(binding);
      });
    },
    pending(binding: string, saveId: string) {
      return db
        .prepare("SELECT commit_id FROM metadata_pending_saves WHERE binding = ? AND save_id = ?")
        .get(binding, saveId)?.["commit_id"] as string | undefined;
    },
    savePending(binding: string, saveId: string, commit: string, at: number) {
      db.prepare(
        "INSERT INTO metadata_pending_saves VALUES (?, ?, ?, ?) ON CONFLICT (binding) DO UPDATE SET save_id=excluded.save_id, commit_id=excluded.commit_id, saved_at=excluded.saved_at",
      ).run(binding, saveId, commit, at);
    },
    current: () => {
      const text = latest();
      if (text === undefined) return undefined;
      const declaration = JSON.parse(text) as TaskMetadataDeclaration;
      return {
        projects: Object.fromEntries(
          Object.entries(declaration.projects).map(([name, project]) => [
            name,
            { ...project, fields: project.fields ?? {} },
          ]),
        ),
      };
    },
    accept(commit: string, declaration: TaskMetadataDeclaration) {
      connection.transaction(() => {
        const text = canonical(declaration);
        if (text !== latest())
          db.prepare(
            "INSERT INTO metadata_declarations (commit_id, declaration, accepted_at) VALUES (?, ?, ?)",
          ).run(commit, text, Date.now());
      });
    },
    reject(commit: string, findings: readonly TaskMetadataFinding[]) {
      db.prepare(
        "INSERT INTO metadata_rejections (commit_id, findings, rejected_at) VALUES (?, ?, ?) ON CONFLICT (commit_id) DO NOTHING",
      ).run(commit, JSON.stringify(findings), Date.now());
    },
  };
}
