// ---
// relationships:
//   verifies: service-assembly
// ---
import { fork } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { afterEach, expect, test } from "vite-plus/test";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { startService } from "./index.ts";
import { serviceFixture } from "./test-fixtures/repository.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
test.each(["committed", "pushed"])(
  "SIGKILL after %s keeps exactly one remote save and loads it on restart",
  async (step) => {
    const fixture = await serviceFixture();
    cleanup.push(fixture.close);
    await git.setConfig({
      fs,
      gitdir: fixture.remote.gitdir,
      path: "http.receivepack",
      value: "true",
    });
    const child = fork(
      join(childArtifacts().service, "service/test-fixtures/blueprint-save-worker.js"),
      [fixture.file, step],
      { stdio: ["ignore", "pipe", "pipe", "ipc"], execArgv: [] },
    );
    cleanup.push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit");
        child.kill("SIGKILL");
        await exit;
      }
    });
    let stderr = "";
    child.stderr?.on("data", (data) => (stderr += String(data)));
    const address = await new Promise<{ host: string; port: number }>((resolve, reject) => {
      child.once("message", (message) => resolve(message as { host: string; port: number }));
      child.once("exit", (code, signal) =>
        reject(new Error(`Exited ${code}/${signal}: ${stderr}`)),
      );
      child.once("error", reject);
    });
    const source = (await fetch(
      `http://${address.host}:${address.port}/api/blueprints/source?path=blueprints/counter.yml`,
    ).then((r) => r.json())) as { text: string };
    const request = {
      path: "blueprints/counter.yml",
      base: fixture.first,
      text: source.text.replace("count: 60", "count: 61"),
      message: "Change counter",
      saveId: "a".repeat(32),
    };
    const exited = once(child, "exit");
    await fetch(`http://${address.host}:${address.port}/api/blueprints/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    }).catch(() => {});
    expect(await exited).toEqual([null, "SIGKILL"]);
    const restarted = await startService({ configurationFile: fixture.file, log: () => {} });
    cleanup.push(restarted.stop);
    const result = await restarted.revisions.save({
      ...request,
      files: [{ path: request.path, text: request.text }],
    });
    expect(result.outcome).toBe(step === "committed" ? "saved" : "already-saved");
    if (result.outcome === "conflict") throw new Error("Unexpected conflict");
    expect(result.blueprints?.commit).toBe(result.commit);
    expect(
      await restarted.revisions.save({
        ...request,
        files: [{ path: request.path, text: request.text }],
      }),
    ).toMatchObject({
      outcome: "already-saved",
      commit: result.commit,
    });
    const log = await git.log({ fs, gitdir: fixture.remote.gitdir, ref: "main" });
    expect(log).toHaveLength(2);
    expect(log[0]?.oid).toBe(result.commit);
  },
  30000,
);
