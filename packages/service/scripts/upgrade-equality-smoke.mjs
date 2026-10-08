// ---
// relationships:
//   verifies: service-distribution
// ---
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
const run = promisify(execFile);
const script = resolve(import.meta.dirname, "manifold-upgrade.sh");
const temporary = await mkdtemp(join(tmpdir(), "upgrade-equality-"));
try {
  for (const difference of ["mode", "link", "bytes", "equal"]) {
    const install = join(temporary, difference);
    const source = join(temporary, `${difference}-source`);
    for (const directory of [install, source]) {
      const tree = join(directory, "manifold-service");
      await mkdir(tree, { recursive: true });
      await writeFile(join(tree, "first"), "same bytes");
      await writeFile(join(tree, "second"), "same bytes");
      await chmod(join(tree, "first"), 0o644);
      await symlink("first", join(tree, "link"));
    }
    if (difference === "mode") await chmod(join(source, "manifold-service/first"), 0o755);
    else if (difference === "link") {
      await rm(join(source, "manifold-service/link"));
      await symlink("second", join(source, "manifold-service/link"));
    }
    if (difference === "bytes")
      await writeFile(join(source, "manifold-service/first"), "different bytes");
    const archive = join(temporary, `${difference}.tar.gz`);
    await run("tar", ["-czf", archive, "-C", source, "manifold-service"]);
    // Reproduce the defect before exercising the operator interface.
    if (difference !== "bytes")
      await run("diff", [
        "-r",
        "-q",
        join(install, "manifold-service"),
        join(source, "manifold-service"),
      ]);
    const { cp, readdir } = await import("node:fs/promises");
    await cp(script, join(install, "manifold-upgrade.sh"));
    await run("sh", [join(install, "manifold-upgrade.sh"), "prepare", archive]);
    assert.equal(
      (await readdir(install)).includes("manifold-service.next"),
      difference !== "equal",
      `${difference}: only a different install remains prepared`,
    );
  }
  console.log("Upgrade equality smoke passed: mode, link target, bytes, and identical installs.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
