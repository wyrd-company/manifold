// ---
// relationships:
//   verifies: [portfolio, service-assembly, usage-intake]
// ---
import { fork, spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { stringify } from "yaml";
import { afterEach, beforeAll, expect, test } from "vite-plus/test";
import { startService } from "../service/index.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
beforeAll(async () => {
  const child = spawn("pnpm", ["run", "build"], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    stdio: "pipe",
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += String(data);
  });
  child.stderr.on("data", (data) => {
    output += String(data);
  });
  expect((await once(child, "exit"))[0], output).toBe(0);
});
test("SIGKILL after capacity commits recovers every pending actual once on the same file", async () => {
  const f = await serviceFixture();
  cleanup.push(f.close);
  await f.commit(60, {
    accounts: {
      accounts: {
        acct: {
          unit: "usd",
          kind: "api",
          capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { hours: 1 } },
          usage: [{ environment: "env-one", provider: "codex" }],
        },
      },
    },
    prices: { unit: "usd", models: { "model-a": { standard: { input: 2, output: 8 } } } },
  });
  await writeFile(join(f.directory, "environment.token"), "example-token");
  await writeFile(
    f.file,
    stringify({
      ...f.configuration,
      credentials: {
        ...f.configuration.credentials,
        environment: { kind: "t3code-token", tokenFile: "environment.token" },
      },
      environments: { "env-one": { url: "http://127.0.0.1:1", credential: "environment" } },
    }),
  );
  const child = fork(
    fileURLToPath(new URL("./test-fixtures/recovery-worker.ts", import.meta.url)),
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
  let output = "";
  const credited = new Promise<void>((resolve) =>
    child.stdout!.on("data", (chunk) => {
      output += String(chunk);
      if (output.includes("credited\n")) resolve();
    }),
  );
  const address = await new Promise<{ host: string; port: number }>((resolve, reject) => {
    child.once("message", (message) => resolve(message as { host: string; port: number }));
    child.once("error", reject);
    child.once("exit", () => reject(new Error("Worker exited before ready")));
  });
  const records = ["one", "two"].map((key) => ({
    type: "call",
    key,
    provider: "codex",
    providerSessionId: "session-one",
    unit: { id: "session-one", kind: "session" },
    timestamp: "2026-01-01T00:10:00.000Z",
    model: "model-a",
    tokens: {
      input: 1,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      cacheWriteOneHour: 0,
      reasoning: 0,
      webSearchRequests: 0,
    },
    speed: "standard",
    granularity: "call",
    estimated: false,
  }));
  const response = await fetch(`http://${address.host}:${address.port}/api/usage/push`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      environment: "env-one",
      threads: [{ provider: "codex", providerSessionId: "session-one", threadId: "thread-one" }],
      records,
    }),
  });
  expect(await response.json()).toMatchObject({ calls: { pending: 2 } });
  await credited;
  const inspect = new DatabaseSync(join(f.directory, "data/state.sqlite"));
  expect(
    inspect.prepare("SELECT count(*) AS n FROM ledger_operations WHERE kind='credit'").get()?.["n"],
  ).toBe(1);
  expect(
    inspect.prepare("SELECT count(*) AS n FROM usage_postings WHERE reason='no-window'").get()?.[
      "n"
    ],
  ).toBe(2);
  inspect.close();
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  expect(await exited).toEqual([null, "SIGKILL"]);
  for (let restart = 0; restart < 2; restart++) {
    const service = await startService({ configurationFile: f.file, log: () => {} });
    try {
      const db = new DatabaseSync(join(f.directory, "data/state.sqlite"));
      try {
        expect(
          db.prepare("SELECT count(*) AS n FROM ledger_operations WHERE kind='credit'").get()?.[
            "n"
          ],
        ).toBe(1);
        expect(
          db
            .prepare("SELECT operation FROM ledger_entries WHERE kind='actual' ORDER BY operation")
            .all(),
        ).toEqual([{ operation: "usage:env-one:one:1" }, { operation: "usage:env-one:two:1" }]);
        expect(
          db.prepare("SELECT count(*) AS n FROM usage_postings WHERE status='pending'").get()?.[
            "n"
          ],
        ).toBe(0);
      } finally {
        db.close();
      }
    } finally {
      await service.stop();
    }
  }
}, 30000);
