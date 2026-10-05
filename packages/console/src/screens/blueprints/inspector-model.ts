// ---
// relationships:
//   implements: operator-console
// ---
import { pointerKey } from "./blueprint-edits.ts";
export interface InspectorField {
  key: string;
  pointer: string;
  kind: "text" | "yaml" | "boolean" | "type";
  value: unknown;
}
export interface InspectorGroup {
  title: string;
  fields: InspectorField[];
}
const stateGroups = {
  Basics: ["id", "description", "type", "initial", "history", "target"],
  Transitions: ["on", "always", "after", "onDone"],
  "Entry actions": ["entry"],
  "Exit actions": ["exit"],
  Invoke: ["invoke"],
  Gate: ["meta"],
  Tags: ["tags"],
  Output: ["output"],
};
const transitionGroups = {
  Transition: ["target", "guard", "actions", "reenter", "description", "meta"],
};
export function inspectorModel(
  kind: string,
  value: Record<string, unknown>,
  pointer: string,
): InspectorGroup[] {
  return Object.entries(kind === "transition" ? transitionGroups : stateGroups).map(
    ([title, keys]) => ({
      title,
      fields: keys.map((key) => ({
        key,
        pointer: pointer + "/" + pointerKey(key),
        kind: ["id", "description", "initial", "history"].includes(key)
          ? "text"
          : key === "type"
            ? "type"
            : key === "reenter"
              ? "boolean"
              : "yaml",
        value: value[key],
      })),
    }),
  );
}
