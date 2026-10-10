// ---
// relationships:
//   verifies: service-distribution
// ---
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { selectMode, selectCut } from "./smoke-selection.mjs";

test("events and unknown changes retain exhaustive coverage", () => {
  for (const event of ["schedule", "workflow_dispatch", "unknown", undefined])
    assert.equal(selectMode(event, ["README.md"]), "full");
  for (const event of ["push", "pull_request"]) {
    assert.equal(selectMode(event, null), "full");
    assert.equal(selectMode(event, ["README.md"]), "short");
    assert.equal(selectMode(event, []), "short");
    for (const path of [
      "docs/technical-designs/example.yml",
      "testing/live-github/src/check.ts",
      "test-support/limits.ts",
    ])
      assert.equal(selectMode(event, [path]), "short", path);
    assert.equal(selectMode(event, ["README.md", ".npmrc"]), "full");
    for (const path of [
      "packages/service/scripts/manifold-upgrade.sh",
      "packages/service/scripts/new-smoke.mjs",
      "packages/service/src/main.ts",
      "packages/shared/src/index.ts",
      "packages/console/src/main.ts",
      "packages/host-cli/package.json",
      ".npmrc",
      ".pnpmfile.cjs",
      "new-build-input.toml",
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".node-version",
      "Taskfile.yml",
      ".github/workflows/check.yml",
      "tsconfig.base.json",
      "vite.config.ts",
    ])
      assert.equal(selectMode(event, [path]), "full", path);
  }
});

test("short checks every command, operation and interruption kind once; full repeats", () => {
  const seen = new Set();
  for (const command of ["prepare", "swap", "rollback"]) {
    for (const operation of [
      "mkdir -- manifold-service.staging",
      "rm -rf -- manifold-service.staging manifold-service.discard",
      "mv -- manifold-service.next manifold-service.discard",
      "tar -xzf /tmp/archive -C manifold-service.staging",
    ]) {
      for (const cut of [
        "after",
        "extraction",
        "manifold-service.staging",
        "manifold-service.discard",
      ]) {
        assert.equal(selectCut("short", seen, command, operation, cut), true);
        assert.equal(selectCut("short", seen, command, operation, cut), false);
        assert.equal(selectCut("full", seen, command, operation, cut), true);
      }
    }
  }
  for (const recovery of ["present-next", "equal-next", "current-present", "current-absent"]) {
    assert.equal(selectCut("short", seen, "prepare", "mv next discard", "after", recovery), true);
    assert.equal(selectCut("short", seen, "prepare", "mv next discard", "after", recovery), false);
  }
  assert.throws(() => selectCut("invalid", seen, "prepare", "mkdir x", "after"));
});

test("CLI uses PR merge base, push before, and fails closed on unavailable bases", async () => {
  const directory = await mkdtemp(join(tmpdir(), "smoke-routing-"));
  const script = new URL("./smoke-selection.mjs", import.meta.url).pathname;
  const git = (...args) => execFileSync("git", args, { cwd: directory, encoding: "utf8" }).trim();
  try {
    git("init", "-q");
    git("config", "user.name", "Example");
    git("config", "user.email", "example@example.invalid");
    await writeFile(join(directory, "README.md"), "one");
    git("add", ".");
    git("commit", "-qm", "initial");
    const base = git("rev-parse", "HEAD");
    await writeFile(join(directory, "README.md"), "two");
    git("commit", "-qam", "documentation");
    const head = git("rev-parse", "HEAD");
    git("checkout", "-qb", "base", base);
    await writeFile(join(directory, "package.json"), "{}");
    git("add", ".");
    git("commit", "-qm", "base packaging change");
    const advancedBase = git("rev-parse", "HEAD");
    const invoke = (event, before, sha = head) =>
      execFileSync(process.execPath, [script], {
        cwd: directory,
        encoding: "utf8",
        env: { ...process.env, GITHUB_EVENT_NAME: event, SMOKE_BASE: before, SMOKE_HEAD: sha },
      }).trim();
    assert.equal(invoke("push", base), "short");
    assert.equal(invoke("pull_request", advancedBase), "short");
    for (const missing of ["", "0".repeat(40), "f".repeat(40)]) {
      assert.equal(invoke("push", missing), "full");
      assert.equal(invoke("pull_request", missing), "full");
    }
    assert.equal(invoke("push", base, "f".repeat(40)), "full");
    assert.equal(invoke("schedule", base), "full");
    assert.equal(invoke("push", base, advancedBase), "full");
    git("mv", "package.json", "NOTES.md");
    git("commit", "-qm", "move packaging input");
    assert.equal(invoke("push", advancedBase, git("rev-parse", "HEAD")), "full");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("workflow retains both architectures, scheduled full selection and mode-specific bounds", async () => {
  const { readFile } = await import("node:fs/promises");
  const { parse } = await import("yaml");
  const workflow = parse(
    await readFile(new URL("../../../.github/workflows/check.yml", import.meta.url), "utf8"),
  );
  assert.deepEqual(workflow.on.schedule, [{ cron: "0 3 * * 0" }]);
  assert.deepEqual(workflow.jobs.package.strategy.matrix.runner, [
    "ubuntu-24.04",
    "ubuntu-24.04-arm",
  ]);
  assert.equal(workflow.jobs.package.needs, "smoke-selection");
  assert.match(workflow.jobs.package["timeout-minutes"], /outputs.mode == 'short' && 15 \|\| 75/);
  const steps = workflow.jobs["smoke-selection"].steps;
  assert.equal(steps[0].with["fetch-depth"], 0);
  const selection = steps.find((step) => step.id === "smoke-mode");
  assert.equal(
    selection.env.SMOKE_BASE,
    "${{ github.event.pull_request.base.sha || github.event.before }}",
  );
  assert.equal(selection.env.SMOKE_HEAD, "${{ github.event.pull_request.head.sha || github.sha }}");
  assert.match(selection.run, /smoke-selection.mjs/);
  assert.equal(
    workflow.jobs.package.steps.at(-1).run,
    "task package:smoke MODE=${{ needs.smoke-selection.outputs.mode }}",
  );
});
