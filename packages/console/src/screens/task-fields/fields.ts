// ---
// relationships:
//   implements: operator-console
// ---
import type { TaskField, DeclarationFinding } from "@wyrd-company/manifold-shared/declarations-api";
import type { ProjectSummary } from "../../api/projects.ts";
export function fieldGroups(fields: readonly TaskField[], projects: readonly ProjectSummary[]) {
  return [...new Set(fields.map((field) => field.binding))].map((binding) => ({
    binding,
    project: projects.find((p) => p.binding === binding),
    fields: fields.filter((f) => f.binding === binding),
  }));
}
export function fieldAtCursor(cursor: number, fields: readonly TaskField[]) {
  return fields.find((f) => f.range && cursor >= f.range.from && cursor < f.range.to);
}
export function rowFindings(fields: readonly TaskField[], findings: readonly DeclarationFinding[]) {
  return new Map(
    fields.map((field) => {
      const found = findings.filter(
        (f) => f.location === field.location || f.location.startsWith(field.location + "/"),
      );
      return [
        field.location,
        {
          error: found.length > 0,
          typeOrStorage: found.some((f) =>
            /^\/(type|storage)(\/|$)/.test(f.location.slice(field.location.length)),
          ),
        },
      ];
    }),
  );
}
export function fieldScope(field: TaskField, project?: ProjectSummary) {
  return `On ${project ? `${project.owner}/${project.number}` : field.binding}`;
}
