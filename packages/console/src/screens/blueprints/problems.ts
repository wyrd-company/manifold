// ---
// relationships:
//   implements: operator-console
// ---
import type { ApiFinding, GraphState } from "@wyrd-company/manifold-shared/blueprints-api";
export function findingState(finding: ApiFinding, states: readonly GraphState[]) {
  return states
    .filter(
      (state) =>
        finding.location === state.location || finding.location.startsWith(state.location + "/"),
    )
    .sort((a, b) => b.location.length - a.location.length)[0]?.path;
}
export function stateAtCursor(cursor: number, states: readonly GraphState[]) {
  return states
    .filter((state) => state.range && cursor >= state.range.from && cursor <= state.range.to)
    .sort((a, b) => b.location.length - a.location.length)[0]?.path;
}
