// ---
// relationships:
//   implements: operator-console
// ---
import { atPointer, pointerParts } from "./blueprint-edits.ts";
export function transitionField(document: unknown, pointer: string) {
  const parent = pointer.slice(0, pointer.lastIndexOf("/"));
  const candidates = atPointer(document, parent);
  if (Array.isArray(candidates))
    return {
      pointer: parent,
      label: pointerParts(parent).at(-1)!,
      index: Number(pointerParts(pointer).at(-1)),
      count: candidates.length,
    };
  return { pointer, label: pointerParts(pointer).at(-1)!, count: 1 };
}
export function expressionRange(length: number, position?: number) {
  const from = position === undefined ? 0 : Math.max(0, Math.min(position, length));
  return { from, to: position === undefined ? length : Math.min(length, from + 1) };
}
