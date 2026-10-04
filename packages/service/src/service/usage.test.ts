// ---
// relationships:
//   verifies: [usage-intake, service-assembly]
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { stringify } from "yaml";
import { startService } from "./index.ts";
import { serviceFixture } from "./test-fixtures/repository.ts";
import type { UsageCall } from "@wyrd-company/manifold-shared";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
const declarations = (input = 2) => ({
  accounts: {
    accounts: { acct: { unit: "usd", usage: [{ environment: "env-one", provider: "codex" }] } },
  },
  prices: { unit: "usd", models: { "model-a": { standard: { input, output: 8 } } } },
});
const call = (key: string): UsageCall => ({
  type: "call",
  key,
  provider: "codex",
  providerSessionId: "session-one",
  unit: { id: "session-one", kind: "session" },
  timestamp: new Date(100).toISOString(),
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
});
async function fixture(operator = true, projectBinding = false) {
  const f = await serviceFixture();
  cleanup.push(f.close);
  await f.commit(60, {
    ...declarations(),
    ...(projectBinding
      ? {
          bindings: {
            t3codeProjects: {
              "project-binding": { environment: "env-one", project: "project-one", item: "beta" },
            },
          },
        }
      : {}),
  });
  await writeFile(join(f.directory, "operator.token"), "example-token");
  await writeFile(join(f.directory, "environment.token"), "example-environment-token");
  await writeFile(
    f.file,
    stringify({
      ...f.configuration,
      http: { port: 0, ...(operator ? { operatorCredential: "operator" } : {}) },
      credentials: {
        ...f.configuration.credentials,
        operator: { kind: "operator-token", tokenFile: "operator.token" },
        environment: { kind: "t3code-token", tokenFile: "environment.token" },
      },
      environments: { "env-one": { url: "http://127.0.0.1:1", credential: "environment" } },
    }),
  );
  return f;
}
test("assembles usage, guards its HTTP mount and follows declarations through pulls", async () => {
  const f = await fixture();
  const logs: string[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: (entry) => logs.push(entry.event),
    actorHost: (parts) => {
      expect(parts.usage).toBeDefined();
      // Save-hook stand-in retained until the actor host merges.
      parts.usage.saveHook({
        actorId: "actor-one",
        snapshot: {
          status: "active",
          value: "working",
          context: {
            manifold: { environment: "env-one", portfolioItem: "alpha", threads: ["thread-one"] },
          },
        },
      });
      return {
        subscription: () => ({ topics: [] }),
        restore: () => ({ status: "held", reason: "stand-in" }),
      };
    },
  });
  cleanup.push(service.stop);
  const { host, port } = service.http.address();
  const url = `http://${host}:${port}/api/usage/push`;
  const request = (key: string, token?: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: "Bearer " + token } : {}),
      },
      body: JSON.stringify({
        environment: "env-one",
        threads: [{ provider: "codex", providerSessionId: "session-one", threadId: "thread-one" }],
        records: [call(key)],
      }),
    });
  expect((await request("denied")).status).toBe(401);
  expect((await request("denied", "wrong")).status).toBe(401);
  const first = await request("first", "example-token");
  expect(first.status).toBe(200);
  expect(await first.json()).toMatchObject({ calls: { pending: 1 } });
  service.portfolio.ledger.credit({
    key: "credit-one",
    account: "acct",
    window: "window-one",
    opensAt: 0,
    closesAt: 1000,
    amount: 100,
  });
  expect(service.usage.retryPending().posted).toBe(1);
  expect(service.portfolio.ledger.actorUsage("actor-one").accounts[0]?.actual).toBe(2);
  await service.github.stop();
  await f.commit(60, declarations(4));
  await service.revisions.pull();
  expect((await request("second", "example-token")).status).toBe(200);
  expect(service.portfolio.ledger.actorUsage("actor-one").accounts[0]?.actual).toBe(6);
  await f.commit(60, {
    accounts: { accounts: { acct: { unit: "invalid" } } },
    prices: declarations().prices,
  });
  await service.revisions.pull();
  expect(logs).toContain("usage-rejected");
  expect((await request("third", "example-token")).status).toBe(200);
  expect(service.portfolio.ledger.actorUsage("actor-one").accounts[0]?.actual).toBe(10);
});
test("does not serve usage without an operator credential", async () => {
  const f = await fixture(false);
  const service = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(service.stop);
  const { host, port } = service.http.address();
  expect(
    (
      await fetch(`http://${host}:${port}/api/usage/push`, {
        method: "POST",
        headers: { authorization: "Bearer example-token", "content-type": "application/json" },
        body: JSON.stringify({ environment: "env-one", threads: [], records: [call("hidden")] }),
      })
    ).status,
  ).toBe(404);
  expect(
    service.store.connection.database.prepare("SELECT count(*) n FROM usage_calls").get(),
  ).toMatchObject({ n: 0 });
});

test("attributes unowned usage through the assembled T3 Code source and portfolio binding", async () => {
  const f = await fixture(true, true);
  const service = await startService({ configurationFile: f.file, log: () => {} });
  cleanup.push(service.stop);
  const db = service.store.connection.database;
  db.prepare("INSERT INTO t3_environment VALUES (?,?,?,?)").run("env-one", "identity-one", 0, 0);
  db.prepare("INSERT INTO t3_thread VALUES (?,?,?,?,?,?)").run(
    "env-one",
    "thread-one",
    "followed",
    0,
    "{}",
    "project-one",
  );
  service.portfolio.ledger.credit({
    key: "credit-one",
    account: "acct",
    window: "window-one",
    opensAt: 0,
    closesAt: 1000,
    amount: 100,
  });
  const { host, port } = service.http.address();
  const response = await fetch(`http://${host}:${port}/api/usage/push`, {
    method: "POST",
    headers: { authorization: "Bearer example-token", "content-type": "application/json" },
    body: JSON.stringify({
      environment: "env-one",
      threads: [{ provider: "codex", providerSessionId: "session-one", threadId: "thread-one" }],
      records: [call("bound")],
    }),
  });
  expect(response.status).toBe(200);
  expect(db.prepare("SELECT actor,item,account,amount FROM usage_postings").get()).toMatchObject({
    actor: "thread:env-one:thread-one",
    item: "beta",
    account: "acct",
    amount: 2,
  });
});
