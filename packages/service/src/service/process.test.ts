// ---
// relationships:
//   verifies: service-assembly
// ---
import { spawn, fork } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { stringify } from "yaml";
import { afterEach, beforeAll, expect, test } from "vite-plus/test";
import { serviceFixture } from "./test-fixtures/repository.ts";
import { startService } from "./index.ts";
import { signedDelivery } from "../github-source/test-fixtures/api.ts";
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
const main = fileURLToPath(new URL("../../dist/main.js", import.meta.url));
const cwd = fileURLToPath(new URL("../../", import.meta.url));
beforeAll(async () => {
  const child = spawn("pnpm", ["run", "build"], { cwd, stdio: "pipe" });
  let errors = "";
  child.stderr.on("data", (data) => {
    errors += String(data);
  });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(errors);
});
function run(file?: string, args?: string[]) {
  const child = spawn(process.execPath, [main, ...(args ?? (file ? [file] : []))], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const ended = once(child, "exit");
      child.kill("SIGKILL");
      await ended;
    }
  });
  const lines: string[] = [];
  const waiters: { event: string; resolve: () => void; reject: (error: Error) => void }[] = [];
  let text = "";
  child.stderr.on("data", (data) => {
    text += String(data);
    lines.splice(0, lines.length, ...text.split("\n").filter(Boolean));
    for (const waiter of waiters.slice())
      if (lines.some((line) => line.includes(`"event":"${waiter.event}"`))) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve();
      }
  });
  const ended = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        for (const waiter of waiters)
          waiter.reject(new Error(`Exited before ${waiter.event}: ${text}`));
        resolve({ code, signal });
      });
    },
  );
  return {
    child,
    lines,
    ended,
    wait(event: string) {
      if (lines.some((line) => line.includes(`"event":"${event}"`))) return Promise.resolve();
      return new Promise<void>((resolve, reject) => waiters.push({ event, resolve, reject }));
    },
  };
}
test("compiled entry point reports usage and all configuration issues", async () => {
  for (const args of [[], ["one", "two"]]) {
    const p = run(undefined, args);
    expect((await p.ended).code).toBe(2);
    expect(p.lines.join()).toContain("Usage:");
  }
  const f = await serviceFixture();
  cleanup.push(f.close);
  await writeFile(f.file, stringify({ unknown: true }));
  const p = run(f.file);
  expect((await p.ended).code).toBe(1);
  expect(p.lines.join()).toContain("/processRepository");
  expect(p.lines.join()).toContain("/store");
  expect(p.lines.join()).toContain("/unknown");
});
test.each(["SIGTERM", "SIGINT"] as const)(
  "compiled entry point stops once on %s",
  async (signal) => {
    const f = await serviceFixture();
    cleanup.push(f.close);
    const p = run(f.file);
    await p.wait("started");
    const stopped = p.wait("stopped");
    p.child.kill(signal);
    await stopped;
    expect((await p.ended).code).toBe(0);
    expect(p.lines.filter((line) => line.includes('"event":"stopped"'))).toHaveLength(1);
  },
);
test.each(["SIGTERM", "SIGINT"] as const)(
  "%s during startup drains opened resources",
  async (signal) => {
    const f = await serviceFixture();
    cleanup.push(f.close);
    const held = f.remote.holdNext();
    const p = run(f.file);
    await held.reached;
    p.child.kill(signal);
    // Observe the signal receipt through the abort log before sending another.
    await p.wait("start-aborted");
    p.child.kill(signal);
    held.release();
    expect((await p.ended).code).toBe(0);
    expect(p.lines.filter((line) => line.includes('"event":"start-aborted"'))).toHaveLength(1);
    expect(p.lines.some((line) => line.includes('"event":"started"'))).toBe(false);
    expect(p.lines.filter((line) => line.includes('"event":"stopped"'))).toHaveLength(1);
    expect(p.lines.join()).toContain("revisions-idle");
    expect(p.lines.join()).toContain("store-closed");
  },
);
test("an address-in-use start closes every resource and exits", async () => {
  const f = await serviceFixture();
  cleanup.push(f.close);
  const first = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(first.stop);
  const file = join(f.directory, "second.yml");
  await writeFile(
    file,
    stringify({
      ...f.configuration,
      store: { file: "second.sqlite" },
      processRepository: { ...f.configuration.processRepository, directory: "second-clone" },
      http: { port: first.http.address().port },
    }),
  );
  const p = run(file);
  expect((await p.ended).code).toBe(1);
  expect(p.lines.join()).toContain("EADDRINUSE");
  expect(p.lines.join()).toContain("store-closed");
});
function nextMessage(child: ChildProcess) {
  let errors = "";
  child.stderr?.on("data", (data) => {
    errors += String(data);
  });
  return new Promise<{ host: string; port: number }>((resolve, reject) => {
    child.once("message", (message) => resolve(message as { host: string; port: number }));
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      reject(new Error(`Worker exited ${code}/${signal}: ${errors}`)),
    );
  });
}
test("SIGKILL after publish recovers the declaration exactly once", async () => {
  const f = await serviceFixture();
  cleanup.push(f.close);
  const initial = await startService({ configurationFile: f.file, log: () => {} });
  await initial.stop();
  const child = fork(
    fileURLToPath(new URL("./test-fixtures/crash-worker.ts", import.meta.url)),
    [f.file],
    { stdio: ["ignore", "pipe", "pipe", "ipc"] },
  );
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exit = once(child, "exit");
      child.kill("SIGKILL");
      await exit;
    }
  });
  const address = await nextMessage(child);
  const next = await f.commit(70);
  const delivery = signedDelivery("push", {
    ref: "refs/heads/main",
    deleted: false,
    after: next,
    repository: { clone_url: f.remote.url, html_url: f.remote.url },
  });
  const exited = once(child, "exit");
  await fetch(`http://${address.host}:${address.port}/webhooks/github`, {
    method: "POST",
    headers: delivery.headers,
    body: delivery.body,
  });
  expect(await exited).toEqual([null, "SIGKILL"]);
  for (let restart = 0; restart < 2; restart++) {
    const service = await startService({ configurationFile: f.file, log: () => {} });
    expect(service.portfolio.current().commit).toBe(next);
    expect(service.revisions.latest()?.commit).toBe(next);
    const row = service.store.connection.database
      .prepare("SELECT count(*) AS count FROM portfolio_declarations WHERE commit_id = ?")
      .get(next);
    expect(row?.["count"]).toBe(1);
    await service.stop();
  }
}, 30000);
