// ---
// relationships:
//   verifies: service-distribution
// ---
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { checkUpgrades } from "./upgrade-smoke.mjs";
const run = promisify(execFile);

// Small real archives exercise the shipped shell's entire recovery graph.
// The package smoke separately checks native bindings and the real service.
test("short and full retain six cases and recovery-only operations", async () => {
  const results = [];
  for (const mode of ["short", "full"]) {
    const temporary = await mkdtemp(join(tmpdir(), "upgrade-modes-"));
    try {
      const source = join(temporary, "source");
      await mkdir(join(source, "manifold-service/dist"), { recursive: true });
      await writeFile(join(source, "manifold-service/package.json"), "{}");
      await writeFile(join(source, "manifold-service/dist/main.js"), "process.exit(0);\n");
      const archive = join(temporary, "A.tar.gz");
      await run("tar", ["-czf", archive, "-C", source, "manifold-service"]);
      const deployment = join(temporary, "deployment");
      await mkdir(deployment);
      await writeFile(join(deployment, "keep"), "preserved");
      let starts = 0;
      const result = await checkUpgrades({
        archive,
        temporary,
        deployment,
        configuration: "",
        mode,
        tree: async () => await readFile(join(deployment, "keep"), "utf8").then((text) => [text]),
        checkStart: async (path) => {
          assert.equal(await readFile(join(path, "dist/main.js"), "utf8"), "process.exit(0);\n");
          starts++;
        },
        start: (path) => ({
          ended: run(process.execPath, [join(path, "dist/main.js")]).then(
            () => 0,
            (error) => error.code,
          ),
        }),
      });
      assert.equal(result.cases, 6);
      assert.equal(starts, result.starts + 5);
      assert(result.recoveryStates > 3);
      for (const command of ["prepare", "swap", "rollback"])
        assert(result.operations.some((operation) => operation[0] === command));
      results.push(result);
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  assert(results[0].stops < results[1].stops / 2, "Short must substantially reduce interruptions");
  const normalize = (result) =>
    [
      ...new Set(
        result.operations.map(([command, operation, cut]) =>
          JSON.stringify([
            command,
            operation.replace(/tar -xzf .*? -C/, "tar -xzf ARCHIVE -C"),
            cut,
          ]),
        ),
      ),
    ].sort();
  assert.deepEqual(
    normalize(results[0]),
    normalize(results[1]),
    "Every full-mode operation/cut must appear in short mode",
  );
});
