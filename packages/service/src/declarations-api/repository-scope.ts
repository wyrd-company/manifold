// ---
// relationships:
//   implements: declarations-api
// ---
import type { TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { TaskField, TaskFieldScope } from "@wyrd-company/manifold-shared/declarations-api";
import type { DeclarationImpact } from "./types.ts";
export function repositoryFieldScope(
  row: TaskField,
  declaration: TaskMetadataDeclaration,
  plans: readonly DeclarationImpact[],
): TaskFieldScope | undefined {
  const field = declaration.projects[row.binding]?.fields[row.name];
  if (!field || (field.storage.kind !== "label" && field.storage.kind !== "milestone")) return;
  const scopes =
    plans
      .find((p) => p.binding === row.binding)
      ?.scopes?.filter((s) => s.scope.kind === "repository") ?? [];
  const names = [
    ...new Set([
      ...(declaration.projects[row.binding]?.repositories ?? []).filter((r) => !r.endsWith("/*")),
      ...scopes.map((s) => s.scope.name),
    ]),
  ].sort();
  return {
    kind: "repository",
    names,
    sharedWith: [
      ...new Set(scopes.flatMap((s) => s.scope.bindings).filter((b) => b !== row.binding)),
    ],
  };
}
