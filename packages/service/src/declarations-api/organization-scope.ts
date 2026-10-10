// ---
// relationships:
//   implements: declarations-api
// ---
import { scopeOwnership, scopeKey } from "@wyrd-company/manifold-shared";
import type { TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { TaskField, TaskFieldScope } from "@wyrd-company/manifold-shared/declarations-api";
export function organizationScope(
  row: TaskField,
  declaration: TaskMetadataDeclaration | undefined,
): { scope: TaskFieldScope } | Record<string, never> {
  const field = declaration?.projects[row.binding]?.fields[row.name];
  if (!field || (field.storage.kind !== "issue-field" && field.storage.kind !== "issue-type"))
    return {};
  const organization = field.storage.organization;
  const ownership = scopeOwnership(declaration!, {}, () => []).get(
    scopeKey({ kind: "organization", organization }),
  );
  return {
    scope: {
      kind: "organization",
      names: [organization],
      sharedWith: ownership?.bindings.filter((binding) => binding !== row.binding) ?? [],
    },
  };
}
