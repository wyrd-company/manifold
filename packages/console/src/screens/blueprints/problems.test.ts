// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { findingState, stateAtCursor } from "./problems.ts";
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
