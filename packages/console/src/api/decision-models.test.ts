// ---
// relationships:
//   verifies: [declarations-api, operator-console]
// ---
import { expect, test } from "vite-plus/test";
import { mapDecisionModelResult } from "./declarations.ts";
test("model client preserves findings, conflict files and failed response messages", () => {
  const finding = {
    file: "decision-models/quote.yml",
    kind: "model-syntax",
    location: "",
    message: "Broken model",
  };
  expect(mapDecisionModelResult("modelLint", 200, { findings: [finding], warnings: [] })).toEqual({
    kind: "ok",
    body: { findings: [finding], warnings: [] },
  });
  const conflict = {
    error: "conflict",
    message: "Changed",
    reason: "file-changed",
    head: "a".repeat(40),
    files: [{ path: "decision-models/quote.yml", text: "latest" }],
  };
  expect(mapDecisionModelResult("publish", 409, conflict)).toEqual({
    kind: "conflict",
    body: conflict,
  });
  expect(
    mapDecisionModelResult("publish", 200, {
      outcome: "saved",
      commit: "a".repeat(40),
      loaded: true,
    }),
  ).toMatchObject({ kind: "ok" });
  expect(
    mapDecisionModelResult("publish", 200, {
      outcome: "saved",
      commit: "a".repeat(40),
      loaded: "yes",
    }),
  ).toMatchObject({ kind: "failed" });
});
