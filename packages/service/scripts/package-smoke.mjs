// ---
// relationships:
//   verifies: service-distribution
// ---
import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = resolve(import.meta.dirname, "../../..");
const { version } = JSON.parse(await readFile(join(root, "packages/service/package.json"), "utf8"));
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
async function tree(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      for (const [name, value] of await tree(path)) result.push([`${entry.name}/${name}`, value]);
    } else if (entry.isSymbolicLink()) {
      const { readlink } = await import("node:fs/promises");
      result.push([entry.name, await readlink(path)]);
    } else result.push([entry.name, (await readFile(path)).toString("base64")]);
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
    assert(!/(^|\/)test-fixtures(\/|$)|\.test\.[jt]s$/.test(path), `Test material: ${path}`);
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
  const fresh = join(temporary, "fresh");
  await extract(fresh);
  const install = join(temporary, "install");
  await extract(install);
  const current = join(install, "manifold-service");
  const old = join(install, "manifold-service.old");
  const next = join(install, "manifold-service.next");
  assert.deepEqual((await readdir(current)).sort(), ["dist", "node_modules", "package.json"]);
  const expected = await tree(join(fresh, "manifold-service"));
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
  const preserved = await tree(deployment);
  async function prepare(source = archive) {
    await rm(next, { recursive: true, force: true });
    await extract(next, source);
  }
  async function replace(interrupt = false) {
    // If current is absent, old is the recovery tree. Preserve it.
    try {
      await readdir(current);
      await rm(old, { recursive: true, force: true });
      await rename(current, old);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!interrupt) await rename(join(next, "manifold-service"), current);
  }
  async function rollback(interrupt = false) {
    // If old is absent, rollback already finished; do not remove current.
    try {
      await readdir(old);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    await rm(current, { recursive: true, force: true });
    if (!interrupt) await rename(old, current);
  }
  async function finish() {
    assert.deepEqual(await tree(current), expected, "Install differs from a fresh archive");
    // Compare the deployment before starting: SQLite may write on startup.
    assert.deepEqual(await tree(deployment), preserved);
    await checkStart(current, configuration);
    await rm(old, { recursive: true, force: true });
    await rm(next, { recursive: true, force: true });
  }
  await writeFile(join(current, "obsolete"), "old file");
  await mkdir(join(current, "obsolete-directory"));
  await prepare();
  await replace();
  await finish();
  const afterStart = await tree(deployment);
  // New start may change SQLite bytes; capture the next operation's baseline.
  preserved.splice(0, preserved.length, ...afterStart);
  await prepare();
  await replace(true);
  await prepare();
  await replace();
  assert.deepEqual(await tree(old), expected, "Interrupted upgrade lost the recovery install");
  await finish();
  preserved.splice(0, preserved.length, ...(await tree(deployment)));
  const bad = join(temporary, "bad");
  await cp(fresh, bad, { recursive: true });
  await writeFile(join(bad, "manifold-service/dist/main.js"), "process.exitCode = 1;\n");
  const badArchive = join(temporary, "bad.tar.gz");
  await run("tar", ["-czf", badArchive, "-C", bad, "manifold-service"]);
  for (const interrupt of [false, true]) {
    await prepare(badArchive);
    await replace();
    assert.equal(await start(current, configuration).ended, 1);
    await rollback(interrupt);
    if (interrupt) await rollback();
    await rollback(); // Running rollback twice preserves the recovered tree.
    await finish();
    preserved.splice(0, preserved.length, ...(await tree(deployment)));
  }
  process.stdout.write(
    "Archive smoke passed: isolation, native binding, start, HTTP, stop, upgrade, interrupted upgrade, rollback, interrupted rollback.\n",
  );
} finally {
  for (const child of children) {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
  await rm(temporary, { recursive: true, force: true });
}
