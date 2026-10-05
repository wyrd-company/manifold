// ---
// relationships:
//   implements: task-metadata-tables
// ---
import type { TaskMetadataDeclaration, TaskMetadataFinding } from "@wyrd-company/manifold-shared";
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
    current: () => {
      const text = latest();
      return text === undefined ? undefined : (JSON.parse(text) as TaskMetadataDeclaration);
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
