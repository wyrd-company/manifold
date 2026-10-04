// ---
// relationships:
//   verifies: host-cli-portfolio-lint
// ---
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";

describe("compiled portfolio lint", () => {
  let directory = "";
  let buildDirectory = "";
  let binary = "";
  const run = (...args: string[]) =>
    spawnSync(binary, ["portfolio", "lint", ...args], { cwd: directory, encoding: "utf8" });
  beforeAll(() => {
    const cache = resolve("node_modules/.cache");
    mkdirSync(cache, { recursive: true });
    buildDirectory = mkdtempSync(join(cache, "portfolio-build-"));
    binary = join(buildDirectory, "manifold-host");
    // The actual CLI is bundled; only the schema dependency is supplied by this fixture
    // until task 1135 merges. Replace the wrapper with src/cli.ts on rebase.
    const entry = join(buildDirectory, "entry.ts");
    writeFileSync(
      entry,
      `import { portfolioDeclarationAjv } from "@wyrd-company/manifold-shared";
portfolioDeclarationAjv.addSchema({ $id: "https://manifold.wyrd.company/schemas/service-configuration", $defs: { "declared-name": { type: "string", pattern: "^[a-z][a-z0-9]*(-[a-z0-9]+)*$", maxLength: 64 } } });
await import(${JSON.stringify(resolve("src/cli.ts"))});`,
    );
    const build = spawnSync("bun", ["build", entry, "--compile", "--outfile", binary], {
      encoding: "utf8",
    });
    expect(build.status, build.stderr).toBe(0);
  }, 30_000);
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "portfolio-binary-"));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));
  afterAll(() => {
    rmSync(buildDirectory, { recursive: true, force: true });
  });
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
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(
      /^portfolio.yml:\/items\/alpha\/items guarantee-limit .*"alpha".*110%/,
    );
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
