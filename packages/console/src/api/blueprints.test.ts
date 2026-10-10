// ---
// relationships:
//   verifies: [blueprints-api, operator-console]
// ---
import { expect, test, vi, afterEach } from "vite-plus/test";
import {
  mapBlueprintResult,
  fetchBlueprints,
  lintBlueprintText,
  saveBlueprint,
} from "./blueprints.ts";
afterEach(() => vi.unstubAllGlobals());
test("checks success bodies and maps conflict, lint, server and malformed answers", () => {
  expect(mapBlueprintResult("lint", 200, { findings: [], warnings: [] })).toEqual({
    kind: "ok",
    body: { findings: [], warnings: [] },
  });
  expect(mapBlueprintResult("lint", 200, {}).kind).toBe("failed");
  expect(
    mapBlueprintResult("save", 422, {
      error: "invalid",
      message: "Check",
      findings: [],
      warnings: [],
    }).kind,
  ).toBe("invalid");
  expect(
    mapBlueprintResult("save", 409, {
      error: "conflict",
      message: "Changed",
      reason: "file-changed",
      head: "a".repeat(40),
      text: "sample",
    }).kind,
  ).toBe("conflict");
  expect(mapBlueprintResult("save", 502, { error: "remote", message: "Cannot push" })).toEqual({
    kind: "failed",
    message: "Cannot push",
  });
});
test("requests use same origin with no credentials or browser storage and lint accepts abort signal", async () => {
  const mock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ findings: [], warnings: [] })));
  vi.stubGlobal("fetch", mock);
  vi.stubGlobal("localStorage", {
    getItem() {
      throw Error("Must not read storage");
    },
  });
  await fetchBlueprints();
  expect(mock.mock.calls[0]?.[0]).toBe("/api/blueprints");
  const controller = new AbortController();
  await lintBlueprintText("blueprints/sample.yml", "sample", controller.signal);
  expect(mock.mock.calls[1]?.[1]).toEqual({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "blueprints/sample.yml", text: "sample" }),
    signal: controller.signal,
  });
  mock.mockRejectedValue(Error("offline"));
  expect(
    (
      await saveBlueprint({
        path: "blueprints/sample.yml",
        base: "a".repeat(40),
        text: "sample",
        message: "sample",
        saveId: "b".repeat(32),
      })
    ).kind,
  ).toBe("failed");
});
