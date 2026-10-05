// ---
// relationships:
//   verifies: [blueprints-api, operator-console]
// ---
import { expect, it } from "vite-plus/test";
import {
  isBlueprintsResponse,
  isBlueprintSourceResponse,
  isLintResponse,
  isSaveBlueprintResponse,
  isSaveConflictResponse,
} from "./blueprints-api.ts";
const commit = "a".repeat(40);
const item = {
  path: "blueprints/shipping.yml",
  source: "repository",
  status: "loaded",
  findings: 0,
  warnings: 0,
  activeActors: 2,
};
const graph = {
  states: [
    {
      path: "packing",
      key: "packing",
      type: "atomic",
      initial: true,
      invokes: [],
      gated: false,
      location: "/machine/states/packing",
    },
  ],
  transitions: [
    {
      source: "packing",
      trigger: "event",
      label: "packed",
      guarded: false,
      location: "/machine/states/packing/on/packed",
    },
  ],
};
it("validates each response and optional nested fields", () => {
  expect(
    isBlueprintsResponse({
      repository: { url: "https://example.invalid/process.git", branch: "main" },
      commit,
      blueprints: [item],
    }),
  ).toBe(true);
  expect(isBlueprintSourceResponse({ ...item, text: "" })).toBe(false);
  expect(
    isBlueprintSourceResponse({
      path: item.path,
      source: "bundled",
      bundle: "digest",
      text: "",
      findings: [],
      warnings: [],
      graph,
    }),
  ).toBe(true);
  expect(
    isLintResponse({
      findings: [
        {
          kind: "shape",
          location: "",
          message: "Invalid",
          range: { from: 0, to: 1, line: 1, column: 1 },
          detail: "retained",
        },
      ],
      warnings: [],
      graph,
    }),
  ).toBe(true);
  expect(isSaveBlueprintResponse({ outcome: "saved", commit, blueprint: item })).toBe(true);
  expect(
    isSaveConflictResponse({
      error: "conflict",
      message: "Changed",
      reason: "file-changed",
      head: commit,
      text: "",
    }),
  ).toBe(true);
});
it("rejects malformed paths, counters, optional values and nested graph members", () => {
  const list = (mutation: object) =>
    isBlueprintsResponse({
      repository: { url: "", branch: "" },
      blueprints: [{ ...item, ...mutation }],
    });
  for (const path of [
    "blueprints/../shipping.yml",
    "blueprints//shipping.yml",
    "blueprints/./shipping.yml",
    "blueprints/shipping.txt",
    "blueprints/a\\b.yml",
  ])
    expect(list({ path })).toBe(false);
  for (const findings of [-1, 1.2, NaN, Infinity, "0"]) expect(list({ findings })).toBe(false);
  for (const mutation of [
    { commit: "bad" },
    { bundle: "" },
    { replacesBundled: false },
    { description: 3 },
    { extra: true },
  ])
    expect(list(mutation)).toBe(false);
  for (const mutation of [
    { type: "bad" },
    { initial: 1 },
    { invokes: [null] },
    { parent: "" },
    { range: { from: 3, to: 2, line: 1, column: 1 } },
  ])
    expect(
      isLintResponse({
        findings: [],
        warnings: [],
        graph: { ...graph, states: [{ ...graph.states[0], ...mutation }] },
      }),
    ).toBe(false);
  expect(
    isLintResponse({
      findings: [{ kind: "yaml", location: "", message: "Invalid", column: 0 }],
      warnings: [],
    }),
  ).toBe(false);
  expect(isSaveBlueprintResponse({ outcome: "saved", commit, blueprint: null })).toBe(false);
  expect(
    isSaveConflictResponse({ error: "conflict", message: "", reason: "changed", head: commit }),
  ).toBe(false);
});
