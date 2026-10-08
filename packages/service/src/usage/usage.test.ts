// ---
// relationships:
//   verifies: usage-intake
// ---
import { afterEach, expect, it } from "vite-plus/test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore } from "../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../ledger/index.ts";
import { openUsage, usageMigrationSteps } from "./index.ts";
import { lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import type { UsageCall } from "@wyrd-company/manifold-shared";
import { createServer } from "node:http";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0).toReversed()) close();
});
const tokens = (input = 0, output = 0) => ({
  input,
  output,
  cacheRead: 0,
  cacheWrite: 0,
  cacheWriteOneHour: 0,
  reasoning: 0,
  webSearchRequests: 0,
});
const call = (key = "call-1", input = 1000000, output = 500000): UsageCall => ({
  type: "call",
  key,
  provider: "codex",
  providerSessionId: "session-1",
  unit: { id: "session-1", kind: "session" },
  timestamp: new Date(100).toISOString(),
  model: "model-a",
  tokens: tokens(input, output),
  speed: "standard",
  granularity: "call",
  estimated: false,
});
const accounts =
  "accounts:\n  acct:\n    unit: usd\n    kind: api\n    capacity: { amount: 1, reset: '2026-01-01T00:00:00Z', every: { hours: 1 } }\n    usage: [{ environment: env-one, provider: codex }]";
const prices =
  "unit: usd\nmodels:\n  model-a: { standard: { input: 2, output: 8 } }\n  model-c: { standard: { input: 0.2, output: 0.2 } }";
function currentPortfolio() {
  const lint = lintPortfolioDeclaration({
    portfolio: "items: { alpha: {}, beta: {}, gamma: { archived: true } }",
    bindings: undefined,
  });
  if (!lint.ok) throw new Error("Invalid fixture portfolio");
  return { commit: "portfolio-1", declaration: lint.declaration };
}
async function setup(credited = true) {
  const dir = mkdtempSync(join(tmpdir(), "usage-test-"));
  const path = join(dir, "store.sqlite");
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  let store = openStore({ path });
  const connection = store.connection;
  connection.migrate("ledger", ledgerMigrationSteps);
  connection.migrate("usage", usageMigrationSteps);
  const portfolio = parseLedgerPortfolio({
    items: [
      { id: "alpha", parent: null },
      { id: "beta", parent: null },
      { id: "gamma", parent: null, archived: true },
      { id: "other", parent: null },
    ],
    allocations: [
      { item: "alpha", account: "acct", guarantee: 50 },
      { item: "beta", account: "acct", guarantee: 50 },
    ],
  });
  let now = 50;
  let ledger = createLedger({ connection, portfolio, now: () => now });
  const credit = () =>
    ledger.credit({
      key: "credit-1",
      account: "acct",
      window: "w1",
      opensAt: 0,
      closesAt: 10000,
      amount: 100000000,
    });
  if (credited) credit();
  let inputChanges = 0;
  const options = {
    connection,
    ledger,
    portfolio: {
      current: currentPortfolio,
      t3codeProject: () => ({
        item: "beta" as const,
        via: "binding" as const,
        binding: "binding-one",
        archived: false,
      }),
    },
    threadProject: () => "project-1",
    environments: new Set(["env-one"]),
    inputChanged: () => {
      inputChanges++;
    },
    now: () => now,
  };
  let usage = openUsage(options);
  const apply = (a = accounts, p = prices) =>
    usage.apply({ commit: "commit-1", read: async (path) => (path === "accounts.yml" ? a : p) });
  await apply();
  const push = (records: UsageCall[], mapped = true) =>
    usage.push({
      environment: "env-one",
      threads: mapped
        ? [
            {
              provider: "codex",
              providerSessionId: "session-1",
              threadId: "thread-1",
              providerInstance: "instance-1",
            },
          ]
        : [],
      records,
    });
  const save = (status = "active", value: unknown = "working", item = "alpha") =>
    usage.saveHook({
      actorId: "actor-1",
      snapshot: {
        status,
        value,
        context: {
          manifold: { environment: "env-one", portfolioItem: item, threads: ["thread-1"] },
        },
      },
    });
  cleanups.push(() => store.close());
  return {
    store,
    connection,
    get inputChanges() {
      return inputChanges;
    },
    get ledger() {
      return ledger;
    },
    portfolio,
    path,
    apply,
    push,
    save,
    credit,
    get usage() {
      return usage;
    },
    now: (t: number) => {
      now = t;
    },
    restart: () => {
      store.close();
      store = openStore({ path });
      ledger = createLedger({ connection: store.connection, portfolio, now: () => now });
      usage = openUsage({ ...options, connection: store.connection, ledger });
      return usage;
    },
  };
}
it("prices, attributes and replays a call once with its state visit and provider instance", async () => {
  const s = await setup();
  s.save();
  s.now(200);
  s.save("active", "checking");
  expect(s.push([call()]).calls).toEqual({ accepted: 1, pending: 0, replayed: 0 });
  expect(s.push([call()]).calls.replayed).toBe(1);
  expect(s.push([call("call-1", 2000000, 1000000)]).calls.replayed).toBe(1);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6000000);
  expect(
    s.connection.database
      .prepare("SELECT actor,item,visit,account,amount FROM usage_postings")
      .get(),
  ).toMatchObject({ actor: "actor-1", item: "alpha", visit: 1, account: "acct", amount: 6000000 });
  expect(
    s.connection.database.prepare("SELECT provider_instance FROM usage_sessions").get(),
  ).toMatchObject({ provider_instance: "instance-1" });
});
it.each(["done", "stopped"])(
  "settles %s durably, includes late usage and converges",
  async (status) => {
    const s = await setup();
    s.save();
    s.ledger.reserve({ key: "r1", actor: "actor-1", item: "alpha", account: "acct", amount: 10 });
    s.push([call("c1", 7, 0), call("c2", 0, 0)]);
    s.save(status);
    s.save(status);
    s.push([call("late", 1, 0)]);
    const db = new DatabaseSync(s.path);
    try {
      const ledger = createLedger({
        connection: { database: db, transaction: (work) => work() },
        portfolio: s.portfolio,
        now: () => 300,
      });
      expect(ledger.actorUsage("actor-1")).toMatchObject({
        settled: true,
        accounts: [{ estimate: 10, actual: 16, variance: 6, outstanding: 0 }],
      });
    } finally {
      db.close();
    }
    expect(
      s.connection.database.prepare("SELECT count(*) n FROM usage_visits").get(),
    ).toMatchObject({ n: 1 });
    expect(
      s.connection.database.prepare("SELECT count(*) n FROM usage_threads").get(),
    ).toMatchObject({ n: 1 });
  },
);
it("holds error saves without settlement or new visits", async () => {
  const s = await setup();
  s.save();
  s.ledger.reserve({ key: "r1", actor: "actor-1", item: "alpha", account: "acct", amount: 10 });
  s.save("error", "failed");
  expect(s.ledger.actorUsage("actor-1")).toMatchObject({
    settled: false,
    accounts: [{ outstanding: 10 }],
  });
  expect(s.connection.database.prepare("SELECT count(*) n FROM usage_visits").get()).toMatchObject({
    n: 1,
  });
});
it.each([false, true])(
  "charges high-water classes independent of conflicting copy order (reverse=%s)",
  async (reverse) => {
    const s = await setup();
    s.save();
    let records = [call("total", 100, 100), call("total", 200, 0), call("total", 200, 100)].map(
      (c, i) => ({
        ...c,
        granularity: "session-total" as const,
        timestamp: new Date(100 + i).toISOString(),
      }),
    );
    if (reverse) records = records.toReversed();
    for (const c of records) {
      s.push([c]);
      s.push([c]);
    }
    expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(1200);
    expect(
      JSON.parse(
        String(s.connection.database.prepare("SELECT charged FROM usage_calls").get()?.["charged"]),
      ),
    ).toEqual(tokens(200, 100));
  },
);
it("rounds cumulative growth across restart and pending growths", async () => {
  const s = await setup();
  s.save();
  for (let n = 1; n <= 5; n++) {
    s.push([{ ...call("total", n, 0), model: "model-c", granularity: "session-total" }]);
    if (n === 3) s.restart();
  }
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(1);
  for (let n = 1; n <= 5; n++)
    s.push([{ ...call("pending", n, 0), model: "model-b", granularity: "session-total" }]);
  expect(s.usage.retryPending().pending.unpriced).toBe(5);
  await s.apply(accounts, prices + "\n  model-b: { standard: { input: 0.2, output: 0.2 } }");
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(2);
});
it("retains tokens without an account or window and retries when the missing fact arrives", async () => {
  const s = await setup(false);
  s.save();
  await s.apply("");
  expect(s.push([call()]).calls.pending).toBe(1);
  expect(s.usage.retryPending().pending.unaccounted).toBe(1);
  await s.apply();
  expect(s.usage.retryPending().pending.noWindow).toBe(1);
  s.credit();
  expect(s.usage.retryPending().posted).toBe(1);
  expect(s.usage.retryPending().posted).toBe(0);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6000000);
});
it("attributes unowned threads to a project and unmapped sessions to other", async () => {
  const s = await setup();
  s.push([call()]);
  s.push([{ ...call("unmapped"), providerSessionId: "session-2" }], false);
  expect(
    s.connection.database.prepare("SELECT actor,item FROM usage_postings ORDER BY seq").all(),
  ).toMatchObject([
    { actor: "thread:env-one:thread-1", item: "beta" },
    { actor: "session:env-one:codex:session-2", item: "other" },
  ]);
});
it("rejects invalid declarations, keeps the last good declaration and serializes apply", async () => {
  const s = await setup();
  s.save();
  expect(await s.apply("[", prices)).toMatchObject({ status: "rejected" });
  expect(await s.apply()).toMatchObject({ status: "unchanged" });
  s.push([call()]);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6000000);
});
it("migration equals the SQL specification", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(
      readFileSync(
        new URL("../../../../docs/specifications/usage-tables.sql", import.meta.url),
        "utf8",
      ),
    );
    const schema = (database: DatabaseSync) =>
      database
        .prepare(
          "SELECT name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name LIKE 'usage_%' ORDER BY name",
        )
        .all();
    const s = schema(db);
    const migrated = new DatabaseSync(":memory:");
    try {
      for (const step of usageMigrationSteps) migrated.exec(step);
      expect(schema(migrated)).toEqual(s);
    } finally {
      migrated.close();
    }
  } finally {
    db.close();
  }
});
it("listener validates requests before writing and returns protocol status codes", async () => {
  const s = await setup();
  const server = createServer(s.usage.listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => server.close());
  const addr = server.address();
  if (!addr || typeof addr === "string") throw Error();
  const url = `http://127.0.0.1:${addr.port}/api/usage/push`;
  const post = (body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  expect(
    (await post({ environment: "env-one", threads: [], records: [{ type: "call" }] })).status,
  ).toBe(400);
  expect((await post({ environment: "env-two", threads: [], records: [] })).status).toBe(422);
  expect((await fetch(url, { method: "GET" })).status).toBe(405);
  expect((await fetch(url + "-wrong")).status).toBe(404);
  expect((await fetch(url, { method: "POST", body: "{}" })).status).toBe(415);
  expect(
    (
      await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: " ".repeat(8 * 1024 * 1024 + 1),
      })
    ).status,
  ).toBe(413);
  expect(s.connection.database.prepare("SELECT count(*) n FROM usage_calls").get()).toMatchObject({
    n: 0,
  });
});

it("prices cache lifetimes, search, reasoning, aliases, fast speed, and decimal rounding", async () => {
  const s = await setup();
  s.save();
  await s.apply(
    accounts,
    `unit: usd
models:
  model-a:
    aliases: [alias-a]
    standard: { input: 2, output: 8, cacheRead: 0.2, cacheWrite: 2.5, cacheWriteOneHour: 4, webSearchRequest: 0.01 }
    fast: { input: 4, output: 16 }
  model-c: { standard: { input: 0.5, output: 0.123456 } }`,
  );
  s.push([
    {
      ...call("classes", 0, 0),
      model: "alias-a",
      tokens: {
        ...tokens(),
        cacheRead: 1000000,
        cacheWrite: 2000000,
        cacheWriteOneHour: 1000000,
        reasoning: 9000000,
        webSearchRequests: 1,
      },
    },
  ]);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6710000);
  s.push([{ ...call("fast", 1, 1), speed: "fast" }]);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6710020);
  expect(
    s.push([{ ...call("no-fast", 1, 1), model: "model-c", speed: "fast" }]).calls.pending,
  ).toBe(1);
  s.push([
    { ...call("half", 1, 0), model: "model-c" },
    { ...call("decimal", 0, 1000000), model: "model-c" },
  ]);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6833477);
  await s.apply(
    accounts.replace(
      "provider: codex }]",
      "provider: codex }, { environment: env-one, provider: claude }]",
    ),
    `unit: usd
models:
  model-a: {standard: {input: 2, output: 8}}`,
  );
  s.push([
    { ...call("reasoning", 0, 0), provider: "claude", tokens: { ...tokens(), reasoning: 1000000 } },
  ]);
  expect(
    s.connection.database
      .prepare("SELECT amount FROM usage_postings WHERE call_key='reasoning'")
      .get(),
  ).toMatchObject({ amount: 8000000 });
});
it("resolves an instance account before its provider fallback, across persisted mapping and restart", async () => {
  const s = await setup();
  s.save();
  const declaration =
    accounts.replace(
      "usage: [{ environment: env-one, provider: codex }]",
      "usage: [{ environment: env-one, provider: codex, instance: instance-2 }]",
    ) +
    "\n  acct-alt:\n    unit: usd\n    kind: api\n    capacity: { amount: 1, reset: '2026-01-01T00:00:00Z', every: { hours: 1 } }\n    usage: [{ environment: env-one, provider: codex }]";
  await s.apply(declaration);
  s.push([call("pending-instance")]);
  expect(s.usage.retryPending().pending.noWindow).toBe(1);
  await s.apply(declaration.replace("instance-2", "instance-1"));
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6000000);
  s.restart();
  expect(s.push([call("after-restart")]).calls.accepted).toBe(1);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(12000000);
});
it("records source errors and preserves the first session mapping and thread owner", async () => {
  const s = await setup();
  s.save();
  s.usage.saveHook({
    actorId: "actor-2",
    snapshot: {
      status: "active",
      value: "working",
      context: {
        manifold: { environment: "env-one", portfolioItem: "beta", threads: ["thread-1"] },
      },
    },
  });
  const first = s.usage.push({
    environment: "env-one",
    threads: [{ provider: "codex", providerSessionId: "session-1", threadId: "thread-1" }],
    records: [
      {
        type: "source-error",
        provider: "codex",
        source: "/example/session.jsonl",
        code: "truncated",
        records: 1,
      },
    ],
  });
  expect(first.sourceErrors).toBe(1);
  expect(
    s.usage.push({
      environment: "env-one",
      threads: [{ provider: "codex", providerSessionId: "session-1", threadId: "thread-2" }],
      records: [call()],
    }).threads.conflicting,
  ).toBe(1);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(6000000);
  expect(s.ledger.actorUsage("actor-2").accounts).toEqual([]);
  expect(
    s.connection.database.prepare("SELECT records FROM usage_source_errors").get(),
  ).toMatchObject({ records: 1 });
});
it("canonicalizes parallel state values and assigns an early call to the first visit", async () => {
  const s = await setup();
  s.now(200);
  s.save("active", { left: "working", right: "waiting" });
  s.save("active", { right: "waiting", left: "working" });
  s.now(300);
  s.save("active", { left: "done", right: "waiting" });
  s.push([call()]);
  expect(s.connection.database.prepare("SELECT visit FROM usage_postings").get()).toMatchObject({
    visit: 1,
  });
  expect(s.connection.database.prepare("SELECT count(*) n FROM usage_visits").get()).toMatchObject({
    n: 2,
  });
});
it("rolls back the entire request when a ledger write fails, and contains listener rejection", async () => {
  const s = await setup();
  let posted = 0;
  const errors: unknown[] = [];
  const broken = openUsage({
    connection: s.connection,
    onError: (error) => errors.push(error),
    ledger: {
      reattribute: s.ledger.reattribute,
      actorUsage: s.ledger.actorUsage,
      settle: s.ledger.settle,
      postActual: (request) => {
        s.ledger.postActual(request);
        if (++posted === 2) throw Error("write failure");
        return { replayed: false };
      },
    },
    portfolio: {
      current: currentPortfolio,
      t3codeProject: () => ({ item: "other", via: "unbound" }),
    },
    threadProject: () => undefined,
    environments: new Set(["env-one"]),
  });
  expect(() =>
    broken.push({ environment: "env-one", threads: [], records: [call("one"), call("two")] }),
  ).toThrow("write failure");
  expect(s.connection.database.prepare("SELECT count(*) n FROM usage_calls").get()).toMatchObject({
    n: 0,
  });
  expect(
    s.connection.database
      .prepare("SELECT count(*) n FROM ledger_entries WHERE kind='actual'")
      .get(),
  ).toMatchObject({ n: 0 });
  posted = 0;
  const server = createServer(broken.listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string") throw Error();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/usage/push`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      environment: "env-one",
      threads: [],
      records: [call("one"), call("two")],
    }),
  });
  expect(response.status).toBe(500);
  expect(errors).toEqual([expect.objectContaining({ message: "write failure" })]);
});

it("falls back to other with missing project and ignores malformed identity members", async () => {
  const s = await setup();
  const usage = openUsage({
    connection: s.connection,
    ledger: s.ledger,
    portfolio: {
      current: currentPortfolio,
      t3codeProject: () => ({
        item: "beta",
        via: "binding",
        binding: "binding-one",
        archived: false,
      }),
    },
    threadProject: () => undefined,
    environments: new Set(["env-one"]),
    now: () => 100,
  });
  usage.saveHook({
    actorId: "actor-2",
    snapshot: {
      status: "active",
      value: "working",
      context: { manifold: { environment: 42, portfolioItem: [], threads: ["thread-1", 42] } },
    },
  });
  usage.push({
    environment: "env-one",
    threads: [{ provider: "codex", providerSessionId: "session-1", threadId: "thread-1" }],
    records: [call()],
  });
  expect(
    s.connection.database.prepare("SELECT actor,item FROM usage_postings").get(),
  ).toMatchObject({ actor: "thread:env-one:thread-1", item: "other" });
  expect(
    s.connection.database
      .prepare("SELECT environment,item FROM usage_actors WHERE actor_id=?")
      .get("actor-2"),
  ).toMatchObject({ environment: null, item: null });
});
it("a failed settlement rolls back ownership and visits with the actor save", async () => {
  const s = await setup();
  const usage = openUsage({
    connection: s.connection,
    ledger: {
      reattribute: s.ledger.reattribute,
      actorUsage: s.ledger.actorUsage,
      postActual: s.ledger.postActual,
      settle: () => {
        throw Error("settlement failed");
      },
    },
    portfolio: {
      current: currentPortfolio,
      t3codeProject: () => ({ item: "other", via: "unbound" }),
    },
    threadProject: () => undefined,
    environments: new Set(["env-one"]),
  });
  expect(() =>
    s.connection.transaction(() => {
      s.store.saveSnapshot({
        actorId: "actor-new",
        machine: "machine-one",
        snapshot: { status: "done", value: "finished" },
      });
      usage.saveHook({
        actorId: "actor-new",
        snapshot: {
          status: "done",
          value: "finished",
          context: { manifold: { environment: "env-one", threads: ["thread-new"] } },
        },
      });
    }),
  ).toThrow("settlement failed");
  expect(s.store.loadSnapshot("actor-new")).toBeUndefined();
  expect(
    s.connection.database
      .prepare("SELECT count(*) n FROM usage_visits WHERE actor_id='actor-new'")
      .get(),
  ).toMatchObject({ n: 0 });
  expect(
    s.connection.database
      .prepare("SELECT count(*) n FROM usage_threads WHERE thread_id='thread-new'")
      .get(),
  ).toMatchObject({ n: 0 });
});

it("the save hook itself rolls back when settlement fails", async () => {
  const s = await setup();
  const usage = openUsage({
    connection: s.connection,
    ledger: {
      reattribute: s.ledger.reattribute,
      actorUsage: s.ledger.actorUsage,
      postActual: s.ledger.postActual,
      settle: () => {
        throw Error("settlement failed");
      },
    },
    portfolio: {
      current: currentPortfolio,
      t3codeProject: () => ({ item: "other", via: "unbound" }),
    },
    threadProject: () => undefined,
    environments: new Set(["env-one"]),
  });
  expect(() =>
    usage.saveHook({ actorId: "actor-new", snapshot: { status: "done", value: "finished" } }),
  ).toThrow("settlement failed");
  expect(
    s.connection.database
      .prepare("SELECT count(*) n FROM usage_actors WHERE actor_id='actor-new'")
      .get(),
  ).toMatchObject({ n: 0 });
});
it("orders declaration reads and postings by apply call order", async () => {
  const s = await setup();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const first = s.usage.apply({
    commit: "first",
    read: async (path) => {
      await held;
      return path === "accounts.yml" ? accounts : prices.replace("input: 2", "input: 3");
    },
  });
  const second = s.usage.apply({
    commit: "second",
    read: async (path) =>
      path === "accounts.yml" ? accounts : prices.replace("input: 2", "input: 4"),
  });
  release();
  await Promise.all([first, second]);
  s.save();
  s.push([call("ordered", 1, 0)]);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(4);
});

it("recovers the apply queue after a revision read rejects", async () => {
  const s = await setup();
  await expect(
    s.usage.apply({
      commit: "unreadable",
      read: async () => {
        throw Error("revision unavailable");
      },
    }),
  ).rejects.toThrow("revision unavailable");
  expect(await s.apply(accounts, prices.replace("input: 2", "input: 3"))).toMatchObject({
    status: "applied",
  });
  s.save();
  s.push([call("read-recovery", 1, 0)]);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(3);
});

it("uses the first visit before equal entry times and the latest visit at those times", async () => {
  const s = await setup();
  s.now(200);
  s.save("active", "working");
  s.save("active", "checking");
  s.push([call("early"), { ...call("at-entry"), timestamp: new Date(200).toISOString() }]);
  expect(
    s.connection.database.prepare("SELECT visit FROM usage_postings ORDER BY seq").all(),
  ).toMatchObject([{ visit: 1 }, { visit: 2 }]);
});

it("retains negative cache reclassification as pending and commits later calls and replays", async () => {
  const s = await setup();
  s.save();
  // Persisted declarations accepted by an earlier service can predate the lint guard.
  s.connection.database
    .prepare(
      "INSERT INTO usage_declarations (commit_id,declaration,accepted_at) VALUES ('legacy',?,0)",
    )
    .run(
      JSON.stringify({
        accounts: {
          acct: {
            unit: "usd",
            kind: "api",
            capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { hours: 1 } },
            usage: [{ environment: "env-one", provider: "codex" }],
          },
        },
        prices: {
          unit: "usd",
          models: {
            "model-a": { standard: { input: 2, output: 8, cacheWrite: 4, cacheWriteOneHour: 1 } },
          },
        },
      }),
    );
  const usage = s.restart();
  const first = {
    ...call("total", 0, 0),
    granularity: "session-total" as const,
    tokens: { ...tokens(), cacheWrite: 1000000 },
  };
  const second = { ...first, tokens: { ...first.tokens, cacheWriteOneHour: 1000000 } };
  const request = {
    environment: "env-one",
    threads: [{ provider: "codex" as const, providerSessionId: "session-1", threadId: "thread-1" }],
    records: [first, second, call("later", 1, 0)],
  };
  expect(usage.push(request).calls).toEqual({ accepted: 2, pending: 1, replayed: 0 });
  expect(usage.push(request).calls).toEqual({ accepted: 0, pending: 0, replayed: 3 });
  expect(usage.retryPending().pending.unpriced).toBe(1);
  expect(s.ledger.actorUsage("actor-1").accounts[0]?.actual).toBe(4000002);
});
it("replays the same thread with a changed instance while retaining its first instance", async () => {
  const s = await setup();
  const mapping = {
    provider: "codex" as const,
    providerSessionId: "session-1",
    threadId: "thread-1",
    providerInstance: "instance-one",
  };
  expect(
    s.usage.push({ environment: "env-one", threads: [mapping], records: [] }).threads.accepted,
  ).toBe(1);
  expect(
    s.usage.push({
      environment: "env-one",
      threads: [{ ...mapping, providerInstance: "instance-two" }],
      records: [],
    }).threads,
  ).toEqual({ accepted: 0, replayed: 1, conflicting: 0 });
  expect(
    s.connection.database.prepare("SELECT provider_instance FROM usage_sessions").get(),
  ).toMatchObject({ provider_instance: "instance-one" });
});

it.each([false, true])(
  "attributes posted calls on mapping-only pushes without moving the charge (settled=%s)",
  async (settled) => {
    const s = await setup();
    s.save();
    s.ledger.reserve({ key: "r1", actor: "actor-1", item: "alpha", account: "acct", amount: 10 });
    s.push([call("late", 1, 1)], false);
    if (settled) s.save("done", "finished");
    const before = s.connection.database.prepare("SELECT * FROM ledger_entries").all();
    expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(0);
    s.push([]);
    expect(s.usage.actorUsage("actor-1")).toEqual({
      settled,
      accounts: [
        { account: "acct", estimate: 10, actual: 10, variance: 0, outstanding: settled ? 0 : 10 },
      ],
    });
    expect(s.usage.actorUsage("session:env-one:codex:session-1").accounts[0]?.actual).toBe(0);
    expect(s.connection.database.prepare("SELECT * FROM ledger_entries").all()).toEqual(before);
    s.push([]);
    expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(10);
    s.restart();
    expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(10);
  },
);
it("reattributes pending calls before posting through the mapping's provider instance", async () => {
  const s = await setup();
  s.save();
  await s.apply(accounts.replace("provider: codex }", "provider: codex, instance: instance-1 }"));
  s.ledger.reserve({ key: "r1", actor: "actor-1", item: "alpha", account: "acct", amount: 10 });
  expect(s.push([call("late", 1, 1)], false).calls.pending).toBe(1);
  s.push([]);
  expect(s.ledger.actorUsage("actor-1").accounts[0]).toMatchObject({ actual: 10, outstanding: 0 });
  expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(10);
  s.push([]);
  expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(10);
});
it("attributes held calls to an unowned thread and adds its account to the usage read", async () => {
  const s = await setup();
  s.push([call("late", 1, 1)], false);
  s.push([]);
  expect(s.usage.actorUsage("thread:env-one:thread-1")).toEqual({
    settled: false,
    accounts: [{ account: "acct", estimate: 0, actual: 10, variance: 10, outstanding: 0 }],
  });
  expect(s.usage.actorUsage("session:env-one:codex:session-1").accounts[0]?.actual).toBe(0);
});

it("rolls back late attribution and mapping when a later call fails, then replays once", async () => {
  const s = await setup();
  s.save();
  s.push([call("held", 1, 1)], false);
  const broken = openUsage({
    connection: s.connection,
    ledger: {
      ...s.ledger,
      postActual: () => {
        throw Error("write failure");
      },
    },
    portfolio: {
      current: currentPortfolio,
      t3codeProject: () => ({ item: "other", via: "unbound" }),
    },
    threadProject: () => undefined,
    environments: new Set(["env-one"]),
  });
  const request = {
    environment: "env-one",
    threads: [{ provider: "codex" as const, providerSessionId: "session-1", threadId: "thread-1" }],
    records: [call("new", 1, 1)],
  };
  expect(() => broken.push(request)).toThrow("write failure");
  expect(s.usage.actorUsage("actor-1").accounts).toEqual([]);
  expect(s.usage.actorUsage("session:env-one:codex:session-1").accounts[0]?.actual).toBe(10);
  expect(s.push([call("new", 1, 1)]).threads.accepted).toBe(1);
  expect(s.push([]).threads.replayed).toBe(1);
  expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(20);
});
it("repairs pre-upgrade posted growths using the stored mapping despite a conflicting push", async () => {
  const s = await setup();
  s.save();
  s.now(200);
  s.save("active", "checking");
  s.push([{ ...call("total", 1, 1), granularity: "session-total" }], false);
  s.push(
    [
      {
        ...call("total", 2, 2),
        timestamp: new Date(200).toISOString(),
        granularity: "session-total",
      },
    ],
    false,
  );
  s.connection.database
    .prepare("INSERT INTO usage_sessions VALUES (?,?,?,?,?,?)")
    .run("env-one", "codex", "session-1", "thread-1", null, 200);
  const request = {
    environment: "env-one",
    threads: [{ provider: "codex" as const, providerSessionId: "session-1", threadId: "thread-2" }],
    records: [],
  };
  expect(s.usage.push(request).threads.conflicting).toBe(1);
  expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(20);
  expect(s.usage.actorUsage("thread:env-one:thread-2").accounts).toEqual([]);
  expect(
    s.connection.database.prepare("SELECT visit FROM usage_reattributions ORDER BY seq").all(),
  ).toMatchObject([{ visit: 1 }, { visit: 2 }]);
  expect(() => s.connection.database.exec("UPDATE usage_reattributions SET item='beta'")).toThrow(
    "append-only",
  );
  expect(() => s.connection.database.exec("DELETE FROM usage_reattributions")).toThrow(
    "append-only",
  );
  s.usage.push(request);
  expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(20);
});

it("keeps ledger account order and appends late-only accounts in name order", async () => {
  const s = await setup();
  s.save();
  s.ledger.reserve({ key: "r1", actor: "actor-1", item: "alpha", account: "acct", amount: 10 });
  for (const [index, account] of ["acct", "zeta", "alpha-acct"].entries()) {
    if (account !== "acct") {
      await s.apply(accounts.replace("  acct:", `  ${account}:`));
      s.ledger.credit({
        key: `credit-${account}`,
        account,
        window: "w1",
        opensAt: 0,
        closesAt: 10000,
        amount: 100,
      });
    }
    s.push([call(`late-${index}`, 1, 1)], false);
  }
  s.push([]);
  expect(s.usage.actorUsage("actor-1").accounts).toEqual([
    { account: "acct", estimate: 10, actual: 10, variance: 0, outstanding: 10 },
    { account: "alpha-acct", estimate: 0, actual: 10, variance: 10, outstanding: 0 },
    { account: "zeta", estimate: 0, actual: 10, variance: 10, outstanding: 0 },
  ]);
});

it.each(["active", "done"])(
  "late ownership counts posted calls for a %s actor, including after a mapping or item move",
  async (status) => {
    const s = await setup();
    s.push([call()], false);
    s.push([]);
    expect(s.usage.unowned()[0]).toMatchObject({
      actor: "thread:env-one:thread-1",
      usage: [{ item: "other", amount: 6000000 }],
    });
    s.usage.move({ from: "thread:env-one:thread-1", to: { item: "beta" } });
    s.save(status);
    s.save(status);
    expect(s.usage.actorUsage("actor-1")).toMatchObject({
      settled: status === "done",
      accounts: [{ actual: 6000000, variance: 6000000 }],
    });
    expect(s.usage.actorUsage("session:env-one:codex:session-1").accounts[0]?.actual).toBe(0);
    expect(s.usage.actorUsage("thread:env-one:thread-1").accounts[0]?.actual).toBe(0);
    expect(s.usage.unowned()).toEqual([]);
    expect(s.ledger.balance({ item: "beta", account: "acct", waiting: [] }).actual).toBe(6000000);
    expect(
      s.connection.database.prepare("SELECT cause FROM usage_reattributions ORDER BY seq").all(),
    ).toEqual([{ cause: "mapping" }, { cause: "move" }, { cause: "ownership" }]);
  },
);

it("moves mixed zero and positive postings through items and a settled actor without consuming its hold", async () => {
  const s = await setup();
  for (let i = 1; i <= 5; i++)
    s.push([{ ...call("growing", i, 0), model: "model-c", granularity: "session-total" }]);
  const from = "thread:env-one:thread-1";
  expect(s.usage.move({ from, to: { item: "alpha" } })).toMatchObject({
    moved: 5,
    accounts: [{ account: "acct", amount: 1 }],
  });
  expect(s.usage.unowned()[0]?.usage).toEqual([
    { item: "alpha", account: "acct", amount: 1, calls: 5 },
  ]);
  expect(s.inputChanges).toBe(1);
  expect(s.usage.move({ from, to: { item: "alpha" } }).moved).toBe(0);
  expect(s.inputChanges).toBe(1);
  s.usage.saveHook({
    actorId: "actor-2",
    snapshot: {
      status: "active" as const,
      value: "working",
      context: { manifold: { portfolioItem: "beta" } },
    },
  });
  s.ledger.reserve({ key: "hold", actor: "actor-2", item: "beta", account: "acct", amount: 10 });
  expect(s.usage.move({ from, to: { actor: "actor-2" } }).moved).toBe(5);
  expect(s.usage.actorUsage("actor-2").accounts[0]).toMatchObject({
    actual: 1,
    variance: -9,
    outstanding: 10,
  });
  s.usage.saveHook({
    actorId: "actor-2",
    snapshot: {
      status: "done",
      value: "finished",
      context: { manifold: { portfolioItem: "beta" } },
    },
  });
  s.push([call("later", 1, 0)]);
  expect(s.usage.move({ from, to: { actor: "actor-2" } }).moved).toBe(1);
  s.save();
  expect(s.usage.actorUsage("actor-1").accounts).toEqual([]);
  expect(s.usage.actorUsage("actor-2").settled).toBe(true);
  expect(s.usage.unowned()).toEqual([]);
  expect(
    s.connection.database
      .prepare("SELECT count(*) n FROM ledger_operations WHERE kind='reattribute'")
      .get(),
  ).toEqual({ n: 3 });
});

it("refuses missing and archived targets even for zero-only usage and leaves pending postings alone", async () => {
  const s = await setup();
  s.push([
    { ...call("zero", 1, 0), model: "model-c" },
    { ...call("pending"), model: "missing" },
  ]);
  const from = "thread:env-one:thread-1";
  for (const to of [{ item: "missing" }, { actor: "unknown" }, { actor: from }])
    expect(() => s.usage.move({ from, to })).toThrow();
  expect(s.usage.move({ from, to: { item: "alpha" } })).toMatchObject({
    moved: 1,
    accounts: [{ amount: 0 }],
  });
  expect(s.usage.unowned()[0]).toMatchObject({
    pending: 1,
    usage: [{ item: "alpha", amount: 0, calls: 1 }],
  });
});

it.each([false, true])(
  "mounted usage, task and portfolio reads include ownership and moves (settled=%s)",
  async (settled) => {
    const s = await setup();
    const { consoleHost } = await import("../console/test-fixtures/host.ts");
    const { openTasks } = await import("../tasks/index.ts");
    const { mountPortfolioApi } = await import("../portfolio-api/index.ts");
    const { isUsageUnownedResponse } = await import("@wyrd-company/manifold-shared/usage-api");
    const host = await consoleHost();
    cleanups.push(() => {
      void host.close();
    });
    const actorId = "task:parcel";
    const snapshot = {
      actorId,
      machine: `${"b".repeat(40)}:blueprints/delivery.yml`,
      snapshot: {
        status: "active" as const,
        value: "working",
        context: {
          manifold: { environment: "env-one", portfolioItem: "alpha", threads: ["thread-1"] },
        },
      },
    };
    s.store.saveSnapshot(snapshot);
    const project = { binding: "sample", owner: "example", number: 1, item: "alpha" };
    const issue = {
      nodeId: "parcel",
      repository: "example/delivery",
      number: 2,
      state: "open" as const,
      title: "Deliver parcel",
    };
    const tasks = openTasks({
      store: s.store,
      held: () => false,
      boundProjects: () => [project],
      github: {
        trackedIssueIds: () => ["parcel"],
        trackedIssue: () => ({ issue, items: [{ project, archived: false, fields: {} }] }),
      },
      actorUsage: s.usage.actorUsage,
      listEscalations: () => [],
      thread: () => undefined,
      tokenHolder: () => undefined,
    });
    host.host.mount("/api/tasks", tasks.requestListener);
    host.host.mount("/api/usage", s.usage.listener);
    mountPortfolioApi(host.host, {
      portfolio: { current: currentPortfolio, ledger: s.ledger },
      accounts: s.usage.accounts,
      processRepository: {
        revisionAt: async (commit) => ({
          commit,
          list: async () => [],
          read: async () => "items: { alpha: {}, beta: {} }",
        }),
      },
      store: s.store,
      now: () => 200,
      log: () => {},
    });
    s.ledger.reserve({ key: "r1", actor: actorId, item: "alpha", account: "acct", amount: 10 });
    s.push([call("owned-later", 1, 1)]);
    s.usage.saveHook({
      actorId,
      snapshot: { ...snapshot.snapshot, status: settled ? "done" : "active" },
    });
    s.usage.push({
      environment: "env-one",
      threads: [{ provider: "codex", providerSessionId: "session-2", threadId: "thread-2" }],
      records: [{ ...call("moved", 1, 1), providerSessionId: "session-2" }],
    });
    const post = (value: unknown) =>
      fetch(host.url + "/api/usage/moves", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(value),
      });
    const before = (await (await fetch(host.url + "/api/portfolio")).json()) as {
      accounts: { window: { used: number } }[];
    };
    expect(
      await (await post({ from: "thread:env-one:thread-2", to: { actor: actorId } })).json(),
    ).toMatchObject({ status: "moved", moved: 1, accounts: [{ amount: 10 }] });
    expect(
      await (await post({ from: "thread:env-one:thread-2", to: { actor: actorId } })).json(),
    ).toMatchObject({ moved: 0 });
    expect(await (await fetch(host.url + "/api/tasks/task%3Aparcel")).json()).toMatchObject({
      task: {
        usage: {
          settled,
          accounts: [{ estimate: 10, actual: 20, variance: 10, reserved: settled ? 0 : 10 }],
        },
      },
    });
    expect(await (await fetch(host.url + "/api/portfolio")).json()).toMatchObject({
      accounts: [{ window: { used: before.accounts[0]!.window.used } }],
      items: expect.arrayContaining([
        expect.objectContaining({
          id: "alpha",
          allocations: expect.arrayContaining([
            expect.objectContaining({ actual: 10, lifetime: 10 }),
          ]),
        }),
      ]),
    });
    // Use partial comparisons so the response's unrelated portfolio fields stay free to evolve.
    const portfolio = (await (await fetch(host.url + "/api/portfolio")).json()) as {
      items: { id: string; allocations: { actual: number; lifetime: number }[] }[];
    };
    expect(portfolio.items.find((i) => i.id === "beta")?.allocations[0]).toMatchObject({
      actual: 10,
      lifetime: 10,
    });
    expect(
      isUsageUnownedResponse(await (await fetch(host.url + "/api/usage/unowned")).json()),
    ).toBe(true);
    for (const to of [{ item: "gamma" }, { actor: "unknown" }])
      expect((await post({ from: "thread:env-one:thread-2", to })).status).toBe(422);
    for (const value of [
      { from: "task:parcel", to: { item: "alpha" } },
      { from: "thread:env-one:thread-2", to: { item: "alpha", actor: actorId } },
      { from: "thread:env-one:thread-2", to: {} },
    ])
      expect((await post(value)).status).toBe(400);
    expect(
      (
        await fetch(host.url + "/api/usage/moves", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: " ".repeat(65537),
        })
      ).status,
    ).toBe(413);
    expect(
      (await fetch(host.url + "/api/usage/unowned", { method: "POST" })).headers.get("allow"),
    ).toBe("GET");
  },
);

it("usage step 3 preserves populated late mappings and every posting", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec(usageMigrationSteps[0]!);
    db.exec(usageMigrationSteps[1]!);
    db.prepare("INSERT INTO usage_calls VALUES (?,?,?,?,?,?)").run(
      "env-one",
      "call-1",
      "{}",
      "{}",
      1,
      0,
    );
    db.prepare(
      "INSERT INTO usage_postings (seq,environment,call_key,revision,used_at,provider,speed,base_tokens,tokens,actor,item,account,amount,status,ledger_key,posted_at) VALUES (7,'env-one','call-1',1,100,'codex','standard','{}','{}','session:env-one:codex:one','other','acct',10,'posted','usage-1',200)",
    ).run();
    db.prepare("INSERT INTO usage_late_attributions VALUES (7,'actor-1','alpha',2,300)").run();
    const before = db.prepare("SELECT * FROM usage_postings").all();
    db.exec(usageMigrationSteps[2]!);
    expect(db.prepare("SELECT * FROM usage_postings").all()).toEqual(before);
    expect(db.prepare("SELECT * FROM usage_reattributions").get()).toEqual({
      seq: 1,
      posting: 7,
      cause: "mapping",
      actor: "actor-1",
      item: "alpha",
      visit: 2,
      ledger_key: null,
      recorded_at: 300,
    });
    expect(
      db
        .prepare(
          "SELECT attributed_actor,attributed_item,attributed_visit,held_actor,held_item,moves FROM usage_attributed_postings",
        )
        .get(),
    ).toEqual({
      attributed_actor: "actor-1",
      attributed_item: "alpha",
      attributed_visit: 2,
      held_actor: "session:env-one:codex:one",
      held_item: "other",
      moves: 0,
    });
    expect(() => db.exec("UPDATE usage_reattributions SET item='beta'")).toThrow("append-only");
    expect(() => db.exec("DELETE FROM usage_reattributions")).toThrow("append-only");
  } finally {
    db.close();
  }
});

it("pending ownership posts under its owner and consumes its hold only once", async () => {
  const s = await setup(false);
  s.push([call("pending-owner", 1, 1)]);
  s.credit();
  s.ledger.reserve({ key: "r1", actor: "actor-1", item: "alpha", account: "acct", amount: 10 });
  s.save();
  s.save();
  expect(s.usage.actorUsage("actor-1").accounts[0]).toMatchObject({ actual: 10, outstanding: 0 });
  expect(s.usage.unowned()).toEqual([]);
});

it("moves an unmapped session then maps it without undoing its held item, and converges across repeated item moves", async () => {
  const s = await setup();
  s.save();
  s.push([call("unmapped", 1, 1)], false);
  const from = "session:env-one:codex:session-1";
  for (const item of ["alpha", "beta", "alpha"])
    expect(s.usage.move({ from, to: { item } }).moved).toBe(1);
  s.push([]);
  expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(10);
  expect(s.ledger.balance({ item: "alpha", account: "acct", waiting: [] }).actual).toBe(10);
  expect(s.usage.unowned()).toEqual([]);
});

it("refuses an archived item before writing zero-only moves and retains the first thread owner", async () => {
  const s = await setup();
  s.push([{ ...call("zero-only", 1, 0), model: "model-c" }]);
  expect(() => s.usage.move({ from: "thread:env-one:thread-1", to: { item: "gamma" } })).toThrow(
    "not archived",
  );
  expect(
    s.connection.database.prepare("SELECT count(*) n FROM usage_reattributions").get(),
  ).toEqual({ n: 0 });
  s.save();
  s.usage.saveHook({
    actorId: "actor-2",
    snapshot: {
      status: "active",
      value: "working",
      context: {
        manifold: { environment: "env-one", portfolioItem: "beta", threads: ["thread-1"] },
      },
    },
  });
  s.push([call("owned", 1, 1)]);
  expect(s.usage.actorUsage("actor-1").accounts[0]?.actual).toBe(10);
  expect(s.usage.actorUsage("actor-2").accounts).toEqual([]);
});

it("refuses unowned actor ids even when an actor row exists for them", async () => {
  const s = await setup();
  const actor = "thread:env-one:thread-1";
  s.usage.saveHook({
    actorId: actor,
    snapshot: {
      status: "active",
      value: "working",
      context: { manifold: { portfolioItem: "alpha" } },
    },
  });
  s.push([call("zero", 1, 0)]);
  expect(() => s.usage.move({ from: actor, to: { actor } })).toThrow("not started");
});

it("move and unowned listener failures are contained and roll the entire move back", async () => {
  const s = await setup();
  s.push([call("one", 1, 1), call("two", 1, 1)]);
  const errors: unknown[] = [];
  let writes = 0;
  const broken = openUsage({
    connection: s.connection,
    ledger: {
      ...s.ledger,
      reattribute: (request) => {
        const result = s.ledger.reattribute(request);
        if (++writes === 2) throw Error("write failure");
        return result;
      },
    },
    portfolio: {
      current: currentPortfolio,
      t3codeProject: () => ({ item: "other", via: "unbound" }),
    },
    threadProject: () => {
      throw Error("read failure");
    },
    environments: new Set(["env-one"]),
    onError: (error) => errors.push(error),
  });
  const server = createServer(broken.listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(() => {
    server.closeAllConnections();
    server.close();
  });
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing fixture address");
  const url = `http://127.0.0.1:${address.port}`;
  expect(
    (
      await fetch(url + "/api/usage/moves", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "thread:env-one:thread-1", to: { item: "alpha" } }),
      })
    ).status,
  ).toBe(500);
  expect(
    s.connection.database.prepare("SELECT count(*) n FROM usage_reattributions").get(),
  ).toEqual({ n: 0 });
  expect(
    s.connection.database
      .prepare("SELECT count(*) n FROM ledger_operations WHERE kind='reattribute'")
      .get(),
  ).toEqual({ n: 0 });
  expect((await fetch(url + "/api/usage/unowned")).status).toBe(500);
  expect(errors).toHaveLength(2);
});

it.each([false, true])(
  "mapping replay writes nothing and never takes usage moved to a task (moved=%s)",
  async (moved) => {
    const s = await setup();
    s.usage.saveHook({
      actorId: "actor-2",
      snapshot: {
        status: "active",
        value: "working",
        context: { manifold: { portfolioItem: "alpha" } },
      },
    });
    s.push([call("unmapped", 1, 1)], false);
    if (moved) s.usage.move({ from: "session:env-one:codex:session-1", to: { actor: "actor-2" } });
    s.push([]);
    const before = s.connection.database.prepare("SELECT * FROM usage_reattributions").all();
    s.push([]);
    expect(s.connection.database.prepare("SELECT * FROM usage_reattributions").all()).toEqual(
      before,
    );
    if (moved) {
      expect(s.usage.actorUsage("actor-2").accounts[0]?.actual).toBe(10);
      expect(s.usage.actorUsage("thread:env-one:thread-1").accounts).toEqual([]);
      expect(s.usage.unowned()).toEqual([]);
      expect(before).toHaveLength(1);
    } else expect(before).toHaveLength(1);
  },
);

it("unowned reads break latest-call ties by actor id and order account and item groups", async () => {
  const s = await setup();
  for (const id of ["a", "z"])
    s.usage.push({
      environment: "env-one",
      threads: [
        { provider: "codex", providerSessionId: `session-${id}`, threadId: `thread-${id}` },
      ],
      records: [{ ...call(`call-${id}`, 1, 1), providerSessionId: `session-${id}` }],
    });
  expect(s.usage.unowned().map((e) => e.actor)).toEqual([
    "thread:env-one:thread-a",
    "thread:env-one:thread-z",
  ]);
  expect(s.usage.unowned()[0]).toMatchObject({
    project: "project-1",
    lastUsedAt: new Date(100).toISOString(),
    usage: [{ account: "acct", item: "beta", calls: 1, amount: 10 }],
  });
});

it("reads the last charged call and unpriced groups across restart, and skips archived usage", async () => {
  const f = await setup();
  f.push([call("priced")]);
  f.push([
    { ...call("pending"), timestamp: new Date(200).toISOString(), model: "model-b" },
    { ...call("no-model"), model: null },
  ]);
  expect(f.usage.lastUsedAt()).toEqual({ acct: 200 });
  expect(f.usage.pricing()).toEqual({
    overrides: 2,
    unpriced: [
      { provider: "codex", model: null, postings: 1 },
      { provider: "codex", model: "model-b", postings: 1 },
    ],
  });
  f.restart();
  expect(f.usage.lastUsedAt()).toEqual({ acct: 200 });
  expect(f.usage.pricing().unpriced).toHaveLength(2);
  await f.apply(accounts.replace("kind: api", "kind: api\n    archived: true"));
  f.push([{ ...call("after-archive"), timestamp: new Date(300).toISOString() }]);
  expect(f.usage.lastUsedAt()).toEqual({ acct: 100 });
  expect(
    (() => {
      const db = new DatabaseSync(f.path);
      try {
        return db
          .prepare("SELECT account, reason FROM usage_postings WHERE call_key = 'after-archive'")
          .get();
      } finally {
        db.close();
      }
    })(),
  ).toMatchObject({ account: null, reason: "unaccounted" });
});

it("pricing excludes pending calls waiting for a window or an account", async () => {
  const f = await setup(false);
  f.push([call("no-window")]);
  expect(f.usage.pricing().unpriced).toEqual([]);
  expect(f.usage.lastUsedAt()).toEqual({ acct: 100 });
  await f.apply("accounts: {}", prices);
  f.push([call("no-account")]);
  expect(f.usage.pricing().unpriced).toEqual([]);
  expect(f.usage.lastUsedAt()).toEqual({});
});
