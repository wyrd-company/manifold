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
    groups: [
      ...new Set(
        rows.map(({ change }) =>
          JSON.stringify([change.storage, change.scope?.kind, change.scope?.name]),
        ),
      ),
    ].map((key) => {
      const groupRows = rows.filter(
        ({ change }) =>
          JSON.stringify([change.storage, change.scope?.kind, change.scope?.name]) === key,
      );
      const first = groupRows[0]!.change;
      const included = groupRows.filter((row) => !row.kept).map((row) => row.change);
      return {
        storage: first.storage,
        scope: first.scope,
        rows: groupRows,
        creates: included.filter((c) => c.action === "create").length,
        changes: included.filter((c) => c.action === "change").length,
        removes: included.filter((c) => c.action === "remove").length,
      };
    }),
  };
}
export const changeTarget = (change: ProjectChange) =>
  (change.target.field ?? "") +
  (change.target.option === undefined
    ? ""
    : `${change.target.field ? " / " : ""}${change.target.option}`);
