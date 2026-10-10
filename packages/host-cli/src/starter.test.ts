// ---
// relationships:
//   verifies: default-process
// ---
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { parse, stringify } from "yaml";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, it } from "vite-plus/test";
import { childArtifacts } from "../../../test-support/child-process.ts";
const starter = fileURLToPath(new URL("../../../examples/starter", import.meta.url));
it("passes every shipped host lint on the starter repository", async () => {
  for (const args of [
    ["manifest", "lint", starter],
    ["portfolio", "lint", starter],
    ["usage", "lint", starter],
    ["task-metadata", "lint", starter],
    ["comparator", "lint", join(starter, "comparators/estimate.ts")],
    ["blueprint", "lint", "--repository", starter],
    [
      "expressions",
      "lint",
      fileURLToPath(new URL("../../service/bundle/blueprints/task.yml", import.meta.url)),
    ],
  ]) {
    const { stdout, stderr } = await promisify(execFile)(childArtifacts().host, args);
    expect(stdout, args.join(" ")).toBe("");
    expect(stderr, args.join(" ")).toBe("");
  }
});

it("checks the shipped default against the repository lifecycle declaration", async () => {
  const directory = await mkdtemp(join(tmpdir(), "starter-lint-"));
  try {
    await writeFile(join(directory, "bindings.yml"), await readFile(join(starter, "bindings.yml")));
    const metadata = parse(await readFile(join(starter, "task-metadata.yml"), "utf8"));
    metadata.projects["work-board"].lifecycle.options = ["Todo", "In Progress"];
    await writeFile(join(directory, "task-metadata.yml"), stringify(metadata));
    await expect(
      promisify(execFile)(childArtifacts().host, ["blueprint", "lint", "--repository", directory]),
    ).rejects.toMatchObject({ code: 1, stdout: expect.stringContaining("lifecycle-option") });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
