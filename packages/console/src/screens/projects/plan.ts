// ---
// relationships:
//   implements: operator-console
// ---
import type { ProjectChange } from "../../api/projects.ts";
export function planGroups(changes: readonly ProjectChange[], removeUndeclared: boolean) {
  const rows = changes.map((change) => ({
    change,
    kept: change.requiresRemoval && !removeUndeclared,
  }));
  const counted = rows.filter((row) => !row.kept).map((row) => row.change);
  return {
    count: counted.length,
    removals: counted.filter((change) => change.requiresRemoval),
    groups: rows.length
      ? [
          {
            storage: "project-field",
            rows,
            creates: counted.filter((c) => c.action === "create").length,
            changes: counted.filter((c) => c.action === "change").length,
            removes: counted.filter((c) => c.action === "remove").length,
          },
        ]
      : [],
  };
}
export const changeTarget = (change: ProjectChange) =>
  change.target.field + (change.target.option === undefined ? "" : ` / ${change.target.option}`);
