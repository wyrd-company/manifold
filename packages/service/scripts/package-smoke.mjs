// ---
// relationships:
//   verifies: service-distribution
// ---
import { createHash } from "node:crypto";
import { lstat, readlink } from "node:fs/promises";
import { checkUpgrades } from "./upgrade-smoke.mjs";
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "../../..");
const { version } = JSON.parse(await readFile(join(root, "packages/service/package.json"), "utf8"));
const mode = process.env.SMOKE_MODE || "full";
assert(["short", "full"].includes(mode), "SMOKE_MODE must be short or full");
const archive = resolve(
  process.argv[2] ||
    join(root, `dist/packages/manifold-service-${version}-linux-${process.arch}.tar.gz`),
);
const temporary = await mkdtemp(join(tmpdir(), "service-archive-"));
const env = { ...process.env };
delete env.NODE_PATH;
const children = new Set();
async function extract(destination, source = archive) {
  await mkdir(destination, { recursive: true });
  await run("tar", ["-xzf", source, "-C", destination]);
}
async function tree(directory, includeRoot = true) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = includeRoot ? [["", "directory", (await lstat(directory)).mode & 0o7777]] : [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    const mode = (await lstat(path)).mode & 0o7777;
    if (entry.isDirectory()) {
      result.push([entry.name, "directory", mode]);
      for (const [name, ...value] of await tree(path, false))
        result.push([`${entry.name}/${name}`, ...value]);
    } else if (entry.isSymbolicLink()) {
      result.push([entry.name, "link", mode, await readlink(path)]);
    } else
      result.push([
        entry.name,
        "file",
        mode,
        createHash("sha256")
          .update(await readFile(path))
          .digest("hex"),
      ]);
  }
  return result;
}
function start(directory, configuration) {
  const child = spawn(process.execPath, [join(directory, "dist/main.js"), configuration], {
    cwd: temporary,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  let output = "";
  const lines = [];
  const waiters = [];
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
    for (const line of output.split("\n")) {
      try {
        lines.push(JSON.parse(line));
      } catch {
        /* Partial line or Node diagnostic. */
      }
    }
    for (const waiter of waiters.splice(0)) waiter();
  });
  const ended = once(child, "exit").then(([code]) => {
    children.delete(child);
    for (const waiter of waiters.splice(0)) waiter();
    return code;
  });
  child.on("error", () => {
    for (const waiter of waiters.splice(0)) waiter();
  });
  return {
    child,
    ended,
    async wait(event) {
      while (!lines.some((line) => line.event === event)) {
        assert.equal(child.exitCode, null, `Exited before ${event}: ${output}`);
        assert.equal(child.signalCode, null, `Signalled before ${event}: ${output}`);
        await new Promise((done) => waiters.push(done));
      }
      return lines.find((line) => line.event === event);
    },
  };
}
async function checkStart(install, configuration) {
  const service = start(install, configuration);
  await service.wait("pull-failed");
  const started = await service.wait("started");
  const base = `http://127.0.0.1:${started.detail.port}`;
  const consoleResponse = await fetch(`${base}/console/`);
  assert.equal(consoleResponse.status, 200);
  assert.match(await consoleResponse.text(), /<html/i);
  const webhook = await fetch(`${base}/webhooks/github`, { method: "POST", body: "{}" });
  assert(webhook.status >= 400 && webhook.status < 500);
  service.child.kill("SIGTERM");
  await service.wait("stopped");
  assert.equal(await service.ended, 0);
}
try {
  const { stdout } = await run("tar", ["-tzf", archive], { maxBuffer: 16 * 1024 * 1024 });
  const paths = stdout.trim().split("\n");
  assert(
    paths.every((path) => path.startsWith("manifold-service/")),
    "Only manifold-service/ may be at archive root",
  );
  for (const path of paths) {
    assert(
      !/(^|\/)(test|tests|__tests__|test-fixtures|spec)(\/|$)|\.(test|spec)\.[jt]s$/.test(path),
      `Test material: ${path}`,
    );
    assert(
      !path.startsWith("manifold-service/src/") &&
        !/\/(@wyrd-company\/manifold-(shared|console)|@wyrd-company\+manifold-(shared|console)[^/]*)\/(?:node_modules\/[^/]+\/[^/]+\/)?src\//.test(
          path,
        ),
      `Workspace source: ${path}`,
    );
  }
  const platforms = paths.filter((path) => /zen-engine-(linux|darwin|win32)/.test(path));
  assert(platforms.length > 0, "Missing native decision engine");
  assert(
    platforms.every((path) => path.includes(`zen-engine-linux-${process.arch}-gnu`)),
    "Wrong native architecture",
  );
  const install = join(temporary, "install");
  await extract(install);
  const current = join(install, "manifold-service");
  assert.deepEqual((await readdir(current)).sort(), ["dist", "node_modules", "package.json"]);
  await assert.rejects(
    run(process.execPath, [join(current, "dist/main.js")], { cwd: temporary, env }),
    (error) => error.code === 2,
  );
  await run(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "const { ZenEngine } = await import('@gorules/zen-engine'); const engine = new ZenEngine(); engine.dispose();",
    ],
    { cwd: current, env },
  );
  const deployment = join(temporary, "deployment");
  await mkdir(join(deployment, "state"), { recursive: true });
  await writeFile(join(deployment, "state", "keep"), "preserve existing state");
  const configuration = join(deployment, "service.yml");
  await writeFile(
    configuration,
    `processRepository:\n  url: http://127.0.0.1:1/recipes.git\n  directory: state/process\nstore:\n  file: state/service.sqlite\nhttp:\n  host: 127.0.0.1\n  port: 0\n`,
  );
  await checkStart(current, configuration);
  await checkUpgrades({
    archive,
    temporary,
    deployment,
    configuration,
    tree,
    checkStart,
    start,
    mode,
  });
  process.stdout.write(
    "Archive smoke passed: isolation, native binding, start, HTTP, stop, upgrade recovery.\n",
  );
} finally {
  for (const child of children) {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
  await rm(temporary, { recursive: true, force: true });
}
