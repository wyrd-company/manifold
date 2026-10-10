// ---
// relationships:
//   verifies: process-repository
// ---
import { fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import * as fs from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { fixture } from "./test-fixtures/remote.ts";
import { openProcessRepository } from "./index.ts";
import type { ProcessRepositoryConfiguration } from "../service-configuration/index.ts";
const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
const credentials = {
  names: [],
  resolve() {
    throw new Error("Not used");
  },
};
async function setup() {
  const directory = await fs.mkdtemp(join(tmpdir(), "crash-"));
  cleanup.push(() => fs.rm(directory, { recursive: true, force: true }));
  const remote = await fixture(directory);
  cleanup.push(() => remote.close());
  const configuration: ProcessRepositoryConfiguration = {
    url: remote.url,
    branch: "main",
    credential: undefined,
    directory: join(directory, "clone"),
    pullTimeoutMs: 5000,
    commitAuthor: { name: "Manifold", email: "manifold@manifold.invalid" },
  };
  return { remote, configuration };
}
function worker(configuration: ProcessRepositoryConfiguration, stopAt: string) {
  const child = fork(
    new URL("./test-fixtures/crash-worker.ts", import.meta.url),
    [JSON.stringify(configuration), stopAt],
    { silent: true },
  );
  let stderr = "";
  child.stderr!.on("data", (chunk) => {
    stderr += String(chunk);
  });
  cleanup.push(() => kill(child));
  function message(expected: string) {
    return new Promise<void>((resolve, reject) => {
      const onMessage = (value: unknown) => {
        if (value === expected) {
          child.off("message", onMessage);
          child.off("exit", onExit);
          resolve();
        }
      };
      const onExit = () => {
        child.off("message", onMessage);
        reject(new Error(`Worker exited before ${expected}: ${stderr}`));
      };
      child.on("message", onMessage);
      child.once("exit", onExit);
    });
  }
  return { child, message };
}
async function kill(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  child.kill("SIGKILL");
  await exited;
}
async function fingerprint(path: string) {
  const stat = await fs.stat(path);
  const hash = createHash("sha256")
    .update(await fs.readFile(path))
    .digest("hex");
  return { inode: stat.ino, size: stat.size, hash };
}
test("killed pull during a large pack leaves prior revision readable and next pull converges", async () => {
  const { remote, configuration } = await setup();
  const a = await remote.commit("first");
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  const b = await remote.commit(randomBytes(1024 * 1024).toString("hex"));
  remote.state.mode = "pack";
  const started = new Promise<void>((resolve) => {
    remote.state.packStarted = resolve;
  });
  const running = worker(configuration, "pack");
  await started;
  await kill(running.child);
  const recovered = await openProcessRepository({ configuration, credentials });
  expect(recovered.current()!.commit).toBe(a);
  expect(await recovered.current()!.read("recipes/a.txt")).toBe("first");
  remote.state.mode = "healthy";
  expect(await recovered.pull()).toMatchObject({ kind: "advanced", commit: b });
  expect(await (await recovered.revisionAt(a))!.read("recipes/a.txt")).toBe("first");
});
test.each([true, false])("replayed held pack is immutable; interrupted=%s", async (interrupted) => {
  const { remote, configuration } = await setup();
  const a = await remote.commit("first");
  const repository = await openProcessRepository({ configuration, credentials });
  await repository.pull();
  const response = remote.responses[0]!;
  const packDirectory = join(configuration.directory, "git/objects/pack");
  const pack = join(
    packDirectory,
    (await fs.readdir(packDirectory)).find((name) => name.endsWith(".pack"))!,
  );
  const before = await fingerprint(pack);
  const b = await remote.commit("second");
  await repository.pull();
  remote.state.mode = "replay";
  remote.state.replay = response;
  await remote.force(a);
  if (interrupted) {
    const running = worker(configuration, "fetched");
    await running.message("fetched");
    await kill(running.child);
  } else expect(await repository.pull()).toEqual({ kind: "advanced", commit: a, previous: b });
  const recovered = await openProcessRepository({ configuration, credentials });
  expect(recovered.current()!.commit).toBe(interrupted ? b : a);
  expect(await fingerprint(pack)).toEqual(before);
  expect(await (await recovered.revisionAt(a))!.read("recipes/a.txt")).toBe("first");
  expect(await (await recovered.revisionAt(b))!.read("recipes/a.txt")).toBe("second");
});
