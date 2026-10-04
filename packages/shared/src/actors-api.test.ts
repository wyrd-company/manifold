// ---
// relationships:
//   verifies: actors-api
// ---
import { expect, test } from "vite-plus/test";
import { isActorsResponse } from "./actors-api.ts";
const actor = {
  actorId: "sample",
  machine: "sample",
  states: ["ready"],
  savedAt: "2026-01-01T00:00:00.000Z",
};
test("accepts actor summaries and optional blueprint and identity fields", () => {
  expect(isActorsResponse({ actors: [] })).toBe(true);
  expect(
    isActorsResponse({
      actors: [
        actor,
        {
          ...actor,
          states: ["working.first.ready", "working.second.waiting"],
          blueprint: { path: "blueprints/sample.yaml", commit: "a".repeat(64) },
          environment: "sample-host",
          project: "sample-project",
          issue: "sample#1",
          portfolioItem: "sample-item",
        },
      ],
    }),
  ).toBe(true);
});
test("rejects malformed response bodies at the shared API boundary", () => {
  for (const value of [
    null,
    [],
    {},
    { actors: null },
    { actors: {} },
    { actors: [null] },
    { actors: [actor], extra: true },
  ])
    expect(isActorsResponse(value)).toBe(false);
  for (const [field, values] of Object.entries({
    actorId: [undefined, "", 1],
    machine: [undefined, "", 1],
    states: [undefined, "ready", [""], [1]],
    savedAt: [undefined, "bad", "2026-02-30T00:00:00.000Z"],
    environment: [null, 1],
    project: [null, 1],
    issue: [null, 1],
    portfolioItem: [null, 1],
    blueprint: [
      null,
      {},
      { path: "sample.yaml", commit: "a".repeat(40) },
      { path: "blueprints/sample.yml", commit: "a" },
      { path: "blueprints/sample.yml", commit: "a".repeat(40), extra: true },
    ],
    extra: [true],
  })) {
    for (const value of values)
      expect(isActorsResponse({ actors: [{ ...actor, [field]: value }] }), field).toBe(false);
  }
});
