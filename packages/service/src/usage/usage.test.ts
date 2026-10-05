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
  const options = {
    connection,
    ledger,
    portfolio: {
      t3codeProject: () => ({
        item: "beta" as const,
        via: "binding" as const,
        binding: "binding-one",
        archived: false,
      }),
    },
    threadProject: () => "project-1",
    environments: new Set(["env-one"]),
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
it("migration equals the SQL specification", async () => {
  expect(usageMigrationSteps[0]).toBe(
    readFileSync(
      new URL("../../../../docs/specifications/usage-tables.sql", import.meta.url),
      "utf8",
    ),
  );
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
      settle: s.ledger.settle,
      postActual: (request) => {
        s.ledger.postActual(request);
        if (++posted === 2) throw Error("write failure");
        return { replayed: false };
      },
    },
    portfolio: { t3codeProject: () => ({ item: "other", via: "unbound" }) },
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
      postActual: s.ledger.postActual,
      settle: () => {
        throw Error("settlement failed");
      },
    },
    portfolio: { t3codeProject: () => ({ item: "other", via: "unbound" }) },
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
      postActual: s.ledger.postActual,
      settle: () => {
        throw Error("settlement failed");
      },
    },
    portfolio: { t3codeProject: () => ({ item: "other", via: "unbound" }) },
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
