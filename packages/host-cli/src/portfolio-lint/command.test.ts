// ---
// relationships:
//   verifies: host-cli-portfolio-lint
// ---
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

describe("compiled portfolio lint", () => {
  let directory = "";
  const binary = childArtifacts().host;
  const run = (...args: string[]) =>
    spawnSync(binary, ["portfolio", "lint", ...args], { cwd: directory, encoding: "utf8" });
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "portfolio-binary-"));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  it("runs without node_modules, defaults to cwd and accepts an empty directory and a clean checkout", () => {
    const empty = run();
    expect([empty.status, empty.stdout, empty.stderr]).toEqual([0, "", ""]);
    writeFileSync(
      join(directory, "portfolio.yml"),
      "items: { alpha: { allocations: { acct: {} } } }",
    );
    writeFileSync(
      join(directory, "bindings.yml"),
      "githubProjects: { first: { owner: example-org, number: 1, environment: env-one, item: alpha } }",
    );
    writeFileSync(
      join(directory, "accounts.yml"),
      "accounts: { acct: { unit: usd, kind: api, capacity: { amount: 10, reset: '2026-01-01T00:00:00Z', every: { days: 1 } } } }",
    );
    const result = run(directory);
    expect([result.status, result.stdout, result.stderr]).toEqual([0, "", ""]);
  });
  it("reports portfolio findings before binding findings and returns one", () => {
    writeFileSync(
      join(directory, "portfolio.yml"),
      "items: { alpha: { items: { beta: { allocations: { acct: { guarantee: 70 } } }, gamma: { allocations: { acct: { guarantee: 40 } } } } } }",
    );
    writeFileSync(
      join(directory, "bindings.yml"),
      "githubProjects: { first: { owner: example-org, number: 1, environment: env-one, item: missing } }",
    );
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toBe("");
    const lines = result.stdout.trim().split("\n");
    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatch(
      /^portfolio.yml:\/items\/alpha\/items guarantee-limit .*"alpha".*110%/,
    );
    expect(lines.slice(2)).toEqual([
      'portfolio.yml:/items/alpha/items/beta/allocations/acct account-undeclared Account "acct" is not declared in accounts.yml. (warning)',
      'portfolio.yml:/items/alpha/items/gamma/allocations/acct account-undeclared Account "acct" is not declared in accounts.yml. (warning)',
    ]);
    expect(lines[1]).toMatch(/^bindings.yml:\/githubProjects\/first\/item unknown-item /);
  });
  it("refuses digit-leading names and malformed YAML", () => {
    writeFileSync(join(directory, "portfolio.yml"), "items: { 1alpha: {} }");
    writeFileSync(join(directory, "bindings.yml"), "githubProjects: [");
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^portfolio.yml:.* schema /);
    expect(result.stdout).toContain("bindings.yml: syntax ");
    expect(result.stderr).toBe("");
  });
  it("refuses unreadable inputs before linting and returns two", () => {
    const missing = run(join(directory, "missing"));
    expect([missing.status, missing.stdout]).toEqual([2, ""]);
    expect(missing.stderr).toContain("missing:");
    writeFileSync(join(directory, "bindings.yml"), "[");
    mkdirSync(join(directory, "portfolio.yml"));
    const unreadable = run();
    expect([unreadable.status, unreadable.stdout]).toEqual([2, ""]);
    expect(unreadable.stderr).toMatch(/^portfolio.yml: /);
  });
  it("rejects extra positional arguments before linting", () => {
    const extra = run(directory, "extra");
    expect([extra.status, extra.stdout]).toEqual([2, ""]);
    expect(extra.stderr).toContain("expected at most one directory");
  });
});
