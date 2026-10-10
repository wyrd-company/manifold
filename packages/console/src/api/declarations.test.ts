// ---
// relationships:
//   verifies: [declarations-api, operator-console]
// ---
import { afterEach, expect, test, vi } from "vite-plus/test";
import {
  editTaskFields,
  fetchBindings,
  fetchDeclarationSource,
  lintDeclarationText,
  mapDeclarationResult,
  saveBinding,
  saveDeclaration,
} from "./declarations.ts";
afterEach(() => vi.unstubAllGlobals());
test("maps validated source, findings, save, conflicts and invalid answers", () => {
  expect(mapDeclarationResult("lint", 200, { findings: [], warnings: [] }).kind).toBe("ok");
  expect(mapDeclarationResult("source", 200, { findings: [], warnings: [] }).kind).toBe("failed");
  expect(
    mapDeclarationResult("save", 409, {
      error: "conflict",
      message: "Changed",
      reason: "branch-moved",
      head: "a".repeat(40),
    }).kind,
  ).toBe("conflict");
  expect(
    mapDeclarationResult("save", 422, {
      error: "invalid",
      message: "Invalid",
      findings: [{ kind: "schema", location: "", message: "Invalid" }],
      warnings: [],
    }).kind,
  ).toBe("invalid");
  expect(
    mapDeclarationResult("save", 422, {
      error: "invalid",
      message: "Invalid",
      findings: [],
      warnings: [],
    }).kind,
  ).toBe("failed");
  expect(mapDeclarationResult("save", 502, { error: "remote", message: "Cannot push" })).toEqual({
    kind: "failed",
    message: "Cannot push",
  });
});
test("requests use declared endpoints and abortable JSON lint, with no authentication", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ findings: [], warnings: [] })));
  vi.stubGlobal("fetch", fetch);
  await fetchDeclarationSource("portfolio.yml");
  await fetchBindings();
  const signal = new AbortController().signal;
  await lintDeclarationText("task-metadata.yml", "draft", signal);
  await editTaskFields({ text: "draft", edit: { kind: "add-field", binding: "shipping" } });
  const fields = { base: "a".repeat(40), message: "Update fields", saveId: "b".repeat(32) };
  await saveDeclaration({ ...fields, path: "portfolio.yml", text: "draft" });
  await saveBinding({
    ...fields,
    edit: {
      kind: "t3code-project",
      mode: "add",
      name: "shipping",
      environment: "local",
      project: "project-1",
      item: "shipping",
    },
  });
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    "/api/declarations/source?path=portfolio.yml",
    "/api/declarations/bindings",
    "/api/declarations/lint",
    "/api/declarations/task-fields/edit",
    "/api/declarations/save",
    "/api/declarations/bindings/save",
  ]);
  expect(fetch.mock.calls[2]?.[1]).toEqual({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "task-metadata.yml", text: "draft" }),
    signal,
  });
  fetch.mockRejectedValue(new Error("offline"));
  expect((await fetchBindings()).kind).toBe("failed");
  fetch.mockResolvedValue(new Response("invalid json"));
  expect((await fetchBindings()).kind).toBe("failed");
});
