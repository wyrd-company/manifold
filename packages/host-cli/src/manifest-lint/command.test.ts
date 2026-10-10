// ---
// relationships:
//   verifies: host-cli-manifest-lint
// ---
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { spawnSync } from "node:child_process";
import { beforeEach, afterEach, expect, it } from "vite-plus/test";
import { stringify } from "yaml";
let directory = "";
const binary = childArtifacts().host;
const run = (...args: string[]) =>
  spawnSync(binary, ["manifest", "lint", ...args], { cwd: directory, encoding: "utf8" });
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "manifest-cli-"));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
const write = (file: string, data: unknown) =>
  writeFileSync(join(directory, file), stringify(data));
const manifest = () => write("manifold.yml", { intake: { decisionModel: "quote.yml" } });
const model = (expression: string) => ({
  nodes: [
    { id: "in", type: "inputNode" },
    {
      id: "quote",
      type: "customNode",
      content: { kind: "jsonataExpression", config: { expression } },
    },
    { id: "out", type: "outputNode" },
  ],
  edges: [
    { id: "a", sourceId: "in", targetId: "quote" },
    { id: "b", sourceId: "quote", targetId: "out" },
  ],
});
it("runs a clean checkout without node_modules, defaulting to cwd", () => {
  manifest();
  write("quote.yml", model('{"quote": 7}'));
  const r = run();
  expect([r.status, r.stdout, r.stderr]).toEqual([0, "", ""]);
});
it("prints missing manifest and model diagnostics", () => {
  expect(run().stdout).toContain("manifold.yml: manifest-missing");
  manifest();
  const r = run();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("manifold.yml:/intake/decisionModel model-missing");
});
it("rejects traversal without reading it and rejects symlink models and directories", () => {
  manifest();
  write("quote.yml", {
    nodes: [{ id: "nested", type: "decisionNode", content: { key: "../outside.yml" } }],
    edges: [],
  });
  let r = run();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("model-key-invalid");
  write("inner.yml", model("{}"));
  rmSync(join(directory, "quote.yml"));
  symlinkSync("inner.yml", join(directory, "quote.yml"));
  r = run();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("model-missing");
  rmSync(join(directory, "quote.yml"));
  mkdirSync(join(directory, "models"));
  write("manifold.yml", { intake: { decisionModel: "models/inner.yml" } });
  symlinkSync("../inner.yml", join(directory, "models/inner.yml"));
  r = run();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("model-missing");
  rmSync(join(directory, "models"), { recursive: true });
  symlinkSync(".", join(directory, "models"));
  r = run();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("model-missing");
});
it("prints cell syntax and warning kinds", () => {
  manifest();
  write("quote.yml", model("("));
  let r = run();
  expect(r.status).toBe(1);
  expect(r.stdout).toContain("quote.yml:/nodes/1/content/config/expression syntax");
  write("quote.yml", {
    nodes: [
      {
        id: "switch",
        type: "customNode",
        content: {
          kind: "jsonataSwitch",
          config: { hitPolicy: "first", statements: [{ id: "yes", condition: "7" }] },
        },
      },
    ],
    edges: [],
  });
  r = run();
  expect(r.status).toBe(0);
  expect(r.stdout).toContain("never-boolean");
  expect(r.stdout).toContain(" (warning)\n");
});
it("returns two with stderr only for IO errors and extra arguments", () => {
  let r = run(join(directory, "missing"));
  expect([r.status, r.stdout]).toEqual([2, ""]);
  expect(r.stderr).toContain("missing:");
  mkdirSync(join(directory, "manifold.yml"));
  r = run();
  expect([r.status, r.stdout]).toEqual([2, ""]);
  expect(r.stderr).toContain("manifold.yml:");
  r = run(directory, "extra");
  expect([r.status, r.stdout]).toEqual([2, ""]);
  expect(r.stderr).toContain("expected at most one directory");
});
