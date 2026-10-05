// ---
// relationships:
//   verifies: host-cli-blueprint-lint
// ---
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { expect, test } from "vite-plus/test";
import { parcelBlueprint } from "./test-fixtures/bundle-worker.ts";
test("compiled repository lint discovers checkout paths and overlays bundled paths", () => {
  const directory = mkdtempSync(join(tmpdir(), "repository-blueprint-"));
  try {
    const binary = join(directory, "lint");
    const build = spawnSync(
      "bun",
      [
        "build",
        "src/blueprint-lint/test-fixtures/bundle-worker.ts",
        "--compile",
        "--outfile",
        binary,
      ],
      { encoding: "utf8" },
    );
    expect(build.status, build.stderr).toBe(0);
    writeFileSync(
      join(directory, "bindings.yml"),
      "githubProjects: { parcels: { owner: sample, number: 1, environment: local, item: shipments } }",
    );
    writeFileSync(
      join(directory, "task-metadata.yml"),
      "projects: { parcels: { lifecycle: { field: Stage, options: [Shipped] } } }",
    );
    const run = () =>
      spawnSync(binary, ["--repository", directory], { cwd: directory, encoding: "utf8" });
    const bundled = run();
    expect(bundled.status).toBe(1);
    expect(bundled.stderr).toBe("");
    expect(bundled.stdout).toContain(
      "blueprints/parcel.yml:/machine/states/packing/invoke/input/status lifecycle-option",
    );
    mkdirSync(join(directory, "blueprints/nested"), { recursive: true });
    writeFileSync(
      join(directory, "blueprints/parcel.yml"),
      parcelBlueprint.replace("Packed", "Shipped"),
    );
    writeFileSync(join(directory, "blueprints/nested/return.yaml"), parcelBlueprint);
    const replaced = run();
    expect(replaced.status).toBe(1);
    expect(replaced.stdout).not.toContain("blueprints/parcel.yml:");
    expect(replaced.stdout).toContain("blueprints/nested/return.yaml:");
    writeFileSync(join(directory, "task-metadata.yml"), "projects: []");
    const rejected = run();
    expect(rejected.status).toBe(2);
    expect(rejected.stdout).toBe("");
    expect(rejected.stderr).toBe(
      "task-metadata.yml: 1 findings; run manifold-host task-metadata lint\n",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);
