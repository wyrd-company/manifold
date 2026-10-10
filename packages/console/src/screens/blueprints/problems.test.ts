// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { findingState, stateAtCursor, findingSelection, findingField } from "./problems.ts";
const states = [
  {
    path: "outer",
    key: "outer",
    location: "/machine/states/outer",
    type: "compound" as const,
    initial: true,
    invokes: [],
    gated: false,
    range: { from: 0, to: 80, line: 1, column: 1 },
  },
  {
    path: "outer.inner",
    key: "inner",
    location: "/machine/states/outer/states/inner",
    type: "atomic" as const,
    initial: true,
    invokes: [],
    gated: false,
    range: { from: 20, to: 60, line: 3, column: 1 },
  },
];
test("findings and cursor select the deepest state, parent findings stay on the parent", () => {
  expect(
    findingState(
      { kind: "target", location: states[1]!.location + "/on/GO", message: "sample" },
      states,
    ),
  ).toBe("outer.inner");
  expect(
    findingState(
      { kind: "shape", location: states[0]!.location + "/initial", message: "sample" },
      states,
    ),
  ).toBe("outer");
  expect(stateAtCursor(30, states)).toBe("outer.inner");
  expect(stateAtCursor(90, states)).toBeUndefined();
});
test("selects the deepest transition before its owning state and the deepest inspector field", () => {
  const graph = {
    states: [{ ...states[0]!, path: "a", location: "/machine/states/a" }],
    transitions: [
      {
        source: "a",
        trigger: "event",
        label: "NEXT",
        guarded: true,
        location: "/machine/states/a/on/NEXT",
      },
    ],
  } as Parameters<typeof findingSelection>[1];
  const finding = { location: "/machine/states/a/on/NEXT/guard/params/expression" } as Parameters<
    typeof findingSelection
  >[0];
  expect(findingSelection(finding, graph)).toBe("/machine/states/a/on/NEXT");
  expect(
    findingField(finding, [
      "/machine/states/a/on/NEXT/guard",
      "/machine/states/a/on/NEXT/guard/params/expression",
    ]),
  ).toBe(finding.location);
});

test("hands the YAML cursor to the containing transition before its state", async () => {
  const { selectionAtCursor, cursorForSelection } = await import("./problems.ts");
  const { blueprintGraph } = await import("@wyrd-company/manifold-shared/blueprint-graph");
  const text =
    "schemas: { input: true, output: true, context: true, events: {} }\nmachine:\n  id: sample\n  initial: waiting\n  states:\n    waiting:\n      on:\n        NEXT: { target: waiting }\n";
  const graph = blueprintGraph(text)!;
  const edge = "/machine/states/waiting/on/NEXT";
  expect(selectionAtCursor(text.indexOf("target"), text, graph)).toBe(edge);
  expect(selectionAtCursor(text.indexOf("waiting:"), text, graph)).toBe("waiting");
  expect(selectionAtCursor(text.indexOf("NEXT:"), text, graph)).toBe(edge);
  expect(selectionAtCursor(text.indexOf("on:"), text, graph)).toBe("waiting");
  expect(cursorForSelection(edge, text)).toBe(text.indexOf("{ target"));
});
