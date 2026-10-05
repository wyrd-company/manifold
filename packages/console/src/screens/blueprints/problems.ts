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
export function findingSelection(
  finding: ApiFinding,
  graph: Pick<
    import("@wyrd-company/manifold-shared/blueprints-api").BlueprintGraph,
    "states" | "transitions"
  >,
) {
  return (
    graph.transitions
      .filter(
        (edge) =>
          finding.location === edge.location || finding.location.startsWith(edge.location + "/"),
      )
      .sort((a, b) => b.location.length - a.location.length)[0]?.location ??
    findingState(finding, graph.states)
  );
}
export function findingField(finding: ApiFinding, pointers: readonly string[]) {
  return pointers
    .filter((pointer) => finding.location === pointer || finding.location.startsWith(pointer + "/"))
    .sort((a, b) => b.length - a.length)[0];
}
