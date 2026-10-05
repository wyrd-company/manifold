// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, it } from "vite-plus/test";
import { transitionField, expressionRange } from "./editor-selection.ts";
it("shows the event key and candidate position, including numeric event names", () => {
  const document = { machine: { on: { NEXT: ["one", "two"], "0": "one" } } };
  expect(transitionField(document, "/machine/on/NEXT/1")).toEqual({
    pointer: "/machine/on/NEXT",
    label: "NEXT",
    index: 1,
    count: 2,
  });
  expect(transitionField(document, "/machine/on/0")).toEqual({
    pointer: "/machine/on/0",
    label: "0",
    count: 1,
  });
});
it("marks one character for a positioned expression finding and the whole field otherwise", () => {
  expect(expressionRange(12, 3)).toEqual({ from: 3, to: 4 });
  expect(expressionRange(12, 99)).toEqual({ from: 12, to: 12 });
  expect(expressionRange(12, -1)).toEqual({ from: 0, to: 1 });
  expect(expressionRange(12)).toEqual({ from: 0, to: 12 });
});
