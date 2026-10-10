// ---
// relationships:
//   implements: operator-console
// ---
import { parseDocument, isNode, isMap, isScalar } from "yaml";
import { pointerParts, statePointer } from "./blueprint-edits.ts";
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

export function cursorForSelection(selection: string | undefined, text: string) {
  if (selection === undefined) return undefined;
  const pointer = selection.startsWith("/")
    ? selection
    : statePointer(selection.replace(/^@initial:/, ""));
  const node = parseDocument(text).getIn(pointerParts(pointer), true);
  return isNode(node) ? node.range?.[0] : undefined;
}
export function selectionAtCursor(
  cursor: number,
  text: string,
  graph: import("@wyrd-company/manifold-shared/blueprints-api").BlueprintGraph,
) {
  const document = parseDocument(text);
  return (
    graph.transitions
      .filter((edge) => {
        const node = document.getIn(pointerParts(edge.location), true);
        const parts = pointerParts(edge.location);
        const key = parts.pop();
        const parent = document.getIn(parts, true);
        const pair = isMap(parent)
          ? parent.items.find((item) => isScalar(item.key) && String(item.key.value) === key)
          : undefined;
        const from = pair && isNode(pair.key) ? pair.key.range?.[0] : undefined;
        return (
          isNode(node) && node.range && cursor >= (from ?? node.range[0]) && cursor <= node.range[1]
        );
      })
      .sort((a, b) => b.location.length - a.location.length)[0]?.location ??
    stateAtCursor(cursor, graph.states)
  );
}
