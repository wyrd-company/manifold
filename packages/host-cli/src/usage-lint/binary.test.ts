// ---
// relationships:
//   verifies: host-cli-usage
// ---
import { beforeAll, afterAll, expect, test } from "vite-plus/test";
import { mkdtemp, mkdir, rm, access, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { compileUsageLint, usageLintCases, writeUsageLintCase } from "./test-fixtures/cases.ts";
let directory: string;
let binary: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "usage-lint-binary-"));
  binary = await compileUsageLint(directory);
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
test.each(usageLintCases)(
  "compiled usage lint handles $name without node_modules",
  async (fixture) => {
    const checkout = join(directory, fixture.name);
    await writeUsageLintCase(checkout, fixture);
    await expect(access(join(checkout, "node_modules"))).rejects.toThrow();
    const result = spawnSync(binary, ["usage", "lint"], { cwd: checkout, encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(fixture.finding ? 1 : 0);
    expect(result.stderr).toBe("");
    if (fixture.finding) expect(result.stdout).toContain(fixture.finding);
    else expect(result.stdout).toBe("");
    if (fixture.name === "ordering")
      expect(
        result.stdout
          .split("\n")
          .filter(Boolean)
          .map((line) => line.split(":")[0]),
      ).toEqual(["accounts.yml", "prices.yml"]);
  },
);
test.each(["missing", "accounts.yml", "prices.yml"])(
  "compiled usage lint names unreadable %s and writes no stdout",
  async (file) => {
    const checkout = join(directory, "unreadable-" + file);
    if (file !== "missing") {
      await mkdir(checkout);
      await mkdir(join(checkout, file));
      await writeFile(join(checkout, file === "accounts.yml" ? "prices.yml" : "accounts.yml"), "[");
    }
    const result = spawnSync(binary, ["usage", "lint", checkout], {
      cwd: directory,
      encoding: "utf8",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr.startsWith(`${file === "missing" ? checkout : file}: `)).toBe(true);
  },
);
