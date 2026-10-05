// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, it } from "vite-plus/test";
import { canvasDocument } from "./canvas-document.ts";
it("keeps malformed YAML outside canvas data", () => {
  expect(canvasDocument("machine: [")).toBeUndefined();
});
it("keeps unresolved aliases outside canvas data", () => {
  expect(canvasDocument("machine: { id: sample }\ndescription: *absent")).toBeUndefined();
});
it("reads valid draft layout for the canvas", () => {
  expect(canvasDocument("machine: { id: sample }\nlayout: { states: {} }")).toEqual({
    machine: { id: "sample" },
    layout: { states: {} },
  });
});
