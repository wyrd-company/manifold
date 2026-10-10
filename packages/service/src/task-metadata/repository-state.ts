// ---
// relationships:
//   implements: task-metadata
// ---
import type { PlanInput } from "./project-types.ts";
/** A newly reached repository stays pending until Apply records its observation. */
export function pendingRepositoryScopes(input: PlanInput) {
  return (input.scopes ?? []).filter(
    (scope) =>
      scope.scope.kind === "repository" && !scope.applied && scope.owned.entities.length > 0,
  ).length;
}
