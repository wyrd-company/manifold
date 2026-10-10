// ---
// relationships:
//   verifies: gate-runtime
// ---
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServiceEscalationRequest } from "../escalations/index.ts";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { blueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { BlueprintDocument } from "@wyrd-company/manifold-shared";
import { openStore } from "../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../ledger/index.ts";
import type { ComparatorLoad } from "../comparator-sandbox/index.ts";
import { createComparatorSandbox } from "../comparator-sandbox/index.ts";
import { createGates, gatesMigrationSteps } from "./index.ts";
import type { GateSave, GateTokenLint, GatesOptions } from "./index.ts";

import { trackedMirror } from "../github-source/test-fixtures/tracked-mirror.ts";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0).toReversed()) close();
});
const path = "blueprints/parcels/sorting.yml";
const commit = "a".repeat(40);
const gate = `${path}#open.lifecycle.waiting`;
const oldest = `export default i => { const p = [...i.population].sort((a,b) => b.age-a.age || a.id.localeCompare(b.id)); return p.length ? {task:p[0].id, reservations:[{account:'acct',amount:2},{account:'acct',amount:3}]} : null; }`;
const single = `export default i => i.holders.length ? null : {task:i.population[0].id, reservations:[{account:'acct',amount:5}]};`;
const document = (
  returnPoint: "exit" | { state: string } = { state: "open.lifecycle.packed" },
  reservation = true,
): BlueprintDocument => ({
  schemas: { input: true, output: true, context: true, events: {} },
  machine: {
    initial: "open",
    states: {
      open: {
        type: "parallel",
        states: {
          lifecycle: {
            initial: "waiting",
            states: {
              waiting: {
                meta: {
                  gate: {
                    comparator: "comparators/order.ts",
                    reservation,
                    return: returnPoint,
                    dependencies: "open.dependencies",
                  },
                },
              },
              working: {},
              packed: {},
              shipped: {},
            },
          },
          dependencies: { initial: "clear", states: { blocked: {}, clear: {} } },
          slot: { initial: "free", states: { free: {}, held: {} } },
        },
      },
      finished: { type: "final" },
    },
  },
});
const snapshot = (state = "waiting", status: "active" | "done" | "stopped" = "active") => ({
  status,
  value: { open: { lifecycle: state, dependencies: "clear", slot: "free" } },
  context: { fields: { size: 1 }, manifold: { portfolioItem: "left", issue: "parcel-1" } },
});
async function fixture(source = oldest, override: Partial<GatesOptions> = {}, doc = document()) {
  const dir = mkdtempSync(join(tmpdir(), "gates-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const store = openStore({ path: join(dir, "store.sqlite"), now: () => 100 });
  cleanup.push(() => store.close());
  store.connection.migrate("ledger", ledgerMigrationSteps);
  store.connection.migrate("gates", gatesMigrationSteps);
  const ledger = createLedger({
    connection: store.connection,
    portfolio: parseLedgerPortfolio({
      items: [
        { id: "left", parent: null },
        { id: "right", parent: null },
      ],
      allocations: [
        { item: "left", account: "acct", guarantee: 50 },
        { item: "right", account: "acct", guarantee: 50 },
      ],
    }),
    now: () => 100,
  });
  ledger.credit({
    key: "credit",
    account: "acct",
    window: "window",
    opensAt: 0,
    closesAt: 10000,
    amount: 1000,
  });
  const blueprint = { key: blueprintVersionKey({ commit, path }), document: doc };
  const versions = new Map([[blueprint.key, blueprint]]);
  const sources = new Map([[commit, source]]);
  const revisionAt = async (c: string) => ({ commit: c, read: async () => sources.get(c) });
  const raised: unknown[] = [],
    withdrawn: Pick<ServiceEscalationRequest, "kind" | "subject">[] = [],
    errors: unknown[] = [],
    scheduled: string[] = [];
  const lint: GateTokenLint = {
    configurations: 1,
    gates: [
      {
        statePath: "open.lifecycle.waiting",
        verdict: "potential",
        location: "",
        findings: [],
        traps: new Set(["trap"]),
      },
    ],
    configurationKey: (s) => JSON.stringify((s as unknown as { value: unknown }).value),
  };
  const options: GatesOptions = {
    store,
    version: async (v) => {
      const b = versions.get(blueprintVersionKey(v));
      return b ? { status: "loaded", blueprint: b } : { status: "missing" };
    },
    revisionAt,
    sandbox: await createComparatorSandbox(),
    portfolio: {
      ledger,
      current: () => ({
        declaration: {
          ledger: {
            items: [
              { id: "left", parent: null },
              { id: "right", parent: null },
            ],
            allocations: [
              { item: "left", account: "acct", guarantee: 50 },
              { item: "right", account: "acct", guarantee: 50 },
            ],
          },
        },
      }),
    },
    lintTokens: () => lint,
    trackedIssueIndex: () => new Map(),
    escalations: {
      raise: (e) => {
        raised.push(e);
        return {
          id: "example",
          raiser: { type: "service", kind: e.kind, subject: e.subject, occurrence: 1 },
          title: "",
          question: e.question,
          choices: e.choices,
          freeText: false,
          destinations: [],
          status: "open",
          raisedAt: 100,
        };
      },
      withdraw: (e) => {
        withdrawn.push(e);
      },
    },
    clock: { now: () => 100 },
    seed: () => 7,
    onError: (e) => errors.push(e),
    ...override,
  };
  const gates = createGates(options);
  cleanup.push(() => gates.stop());
  await gates.revision({ blueprints: new Map([[path, blueprint]]) }, await revisionAt(commit));
  for (let i = 0; i < 20; i++)
    store.saveSnapshot({
      actorId: `parcel-${String(i).padStart(2, "0")}`,
      machine: blueprint.key,
      snapshot: snapshot(),
    });
  const save = (
    actorId: string,
    state = "waiting",
    entered: readonly string[] = [],
    entryId = "entry-1",
    status: "active" | "done" | "stopped" = "active",
  ) => {
    const write: GateSave = {
      actorId,
      machine: blueprint.key,
      snapshot: snapshot(state, status),
      entered,
      entries: { "open.lifecycle.waiting": entryId },
      activeInvokes: [],
    };
    store.connection.transaction(() => {
      store.saveSnapshot(write);
      gates.saved(write);
    });
  };
  const rows = (table: string) => store.connection.database.prepare(`SELECT * FROM ${table}`).all();
  const start = async () => {
    await gates.prepare();
    gates.afterDrain({ schedule: (id) => scheduled.push(id) });
  };
  return {
    store,
    ledger,
    gates,
    options,
    doc,
    blueprint,
    versions,
    sources,
    revisionAt,
    raised,
    withdrawn,
    errors,
    scheduled,
    save,
    rows,
    start,
    dir,
  };
}

it("grants twenty entries in age order, atomically reserves once, records and replays each evaluation", async () => {
  let time = 0;
  const f = await fixture(oldest, { clock: { now: () => time } });
  for (let i = 0; i < 20; i++) {
    time = (i * 7) % 20;

    f.gates.saved({
      actorId: `parcel-${String(i).padStart(2, "0")}`,
      machine: f.blueprint.key,
      snapshot: snapshot(),
      entered: ["open.lifecycle.waiting"],
      entries: { "open.lifecycle.waiting": `entry-${i}` },
      activeInvokes: [],
    });
  }
  time = 100;
  await f.start();
  expect(f.rows("gates_token")).toHaveLength(20);
  expect(f.scheduled).toEqual(
    Array.from({ length: 20 }, (_, i) => i)
      .sort((a, b) => ((a * 7) % 20) - ((b * 7) % 20))
      .map((i) => `parcel-${String(i).padStart(2, "0")}`),
  );
  expect(f.ledger.actorUsage("parcel-00").accounts[0]?.outstanding).toBe(5);
  expect(f.store.pendingInbox("parcel-00")[0]?.payload).toMatchObject({
    gate,
    reservations: [{ account: "acct", amount: 5 }],
  });
  const evaluation = f.rows("gates_evaluation")[0]!;
  const replay = await f.gates.replay(Number(evaluation["evaluation_id"]));
  expect(replay.replayed).toMatchObject({ ok: true, selection: { task: "parcel-00" } });
  expect(replay.recorded).toMatchObject({ ok: true, selection: { task: "parcel-00" } });
  f.gates.afterDrain({ schedule: () => {} });
  expect(f.rows("gates_token")).toHaveLength(20);
  expect(gatesMigrationSteps[0]).toBe(
    readFileSync(
      new URL("../../../../docs/specifications/gates-database-schema.sql", import.meta.url),
      "utf8",
    ),
  );
});
it("counts pending holders and excludes actors with earlier inbox events", async () => {
  const f = await fixture(single);
  f.store.writeInbox({ eventId: "previous", topic: "parcel", payload: { type: "changed" } }, [
    "parcel-00",
  ]);
  await f.start();
  expect(f.rows("gates_token")).toHaveLength(1);
  expect(f.rows("gates_token")[0]?.["actor_id"]).toBe("parcel-01");
  expect(JSON.parse(String(f.rows("gates_evaluation")[1]?.["input"])).holders).toEqual([
    { id: "parcel-01", item: "left" },
  ]);
});
it("reconciles bootstrap identity, preserves repeated saves, and returns only on real exit/re-entry", async () => {
  const f = await fixture(single, {}, document("exit"));
  await f.start();
  const entry = f.rows("gates_entry")[0]!;
  f.save("parcel-00");
  f.save("parcel-00");
  expect(f.rows("gates_entry")[0]).toEqual({ ...entry, state_entry_id: "entry-1" });
  expect(f.rows("gates_token")[0]).toMatchObject({ state_entry_id: "entry-1", returned_at: null });
  f.save("parcel-00", "waiting", ["open.lifecycle.waiting"], "entry-2");
  expect(f.rows("gates_token")[0]).toMatchObject({
    return_reason: "return-point",
    return_state: "exit",
  });
  expect(f.rows("gates_entry")[19]?.["entry_id"]).not.toBe(entry["entry_id"]);
});
it("returns at transient return states and on end, but keeps tokens on error", async () => {
  const f = await fixture();
  await f.start();
  f.save("parcel-00", "shipped", ["open.lifecycle.packed"]);
  expect(f.rows("gates_token")[0]).toMatchObject({
    return_reason: "return-point",
    return_state: "open.lifecycle.packed",
  });
  f.gates.saved({
    actorId: "parcel-01",
    machine: f.blueprint.key,
    snapshot: { status: "error" },
    entries: {},
    entered: [],
    activeInvokes: [],
  });
  expect(f.rows("gates_token")[1]?.["returned_at"]).toBeNull();
  f.save("parcel-01", "working", [], "entry-1", "done");
  f.save("parcel-02", "working", [], "entry-1", "stopped");
  expect(f.rows("gates_token")[1]?.["return_reason"]).toBe("ended");
  expect(f.rows("gates_token")[2]?.["return_reason"]).toBe("ended");
});
it("raises once per trap entry, handles return idempotently, and withdraws on actor end", async () => {
  const f = await fixture(single, {
    lintTokens: () => ({
      configurations: 1,
      gates: [
        {
          statePath: "open.lifecycle.waiting",
          verdict: "potential",
          location: "",
          findings: [],
          traps: new Set(["trap"]),
        },
      ],
      configurationKey: () => "trap",
    }),
  });
  await f.start();
  f.save("parcel-00", "working");
  f.save("parcel-00", "working");
  expect(f.raised).toHaveLength(1);
  const token = String(f.rows("gates_token")[0]?.["token_id"]);
  const after = f.store.connection.transaction(() =>
    f.gates.strandedToken(answered({ gate, tokenId: token }, { choice: "return" })),
  );
  after?.();
  expect(f.rows("gates_token")[0]?.["return_reason"]).toBe("escalation");
  expect(
    f.gates.strandedToken(answered({ gate, tokenId: token }, { choice: "return" })),
  ).toBeUndefined();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(f.rows("gates_token")).toHaveLength(2);
  f.save("parcel-01", "working");
  f.save("parcel-01", "working", [], "entry-1", "done");
  expect(f.withdrawn.filter((e) => e.kind === "stranded-token")).toHaveLength(2);
});
it("queries a state across versions and lets afterDrain schedule gate inbox rows", async () => {
  const f = await fixture(single);
  const newer = blueprintVersionKey({ commit: "b".repeat(40), path });
  f.store.saveSnapshot({ actorId: "parcel-new", machine: newer, snapshot: snapshot() });
  expect(f.store.findActorsInState({ statePath: "open.lifecycle.waiting" })).toHaveLength(21);
  const { startRouter } = await import("../router/index.ts");
  let delivered = 0;
  const router = startRouter({
    store: f.store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: (s) => ({
        status: "restored",
        target: {
          actorId: s.actorId,
          send: () => {
            delivered++;
          },
          persist: () => ({ machine: s.machine, snapshot: s.snapshot }),
        },
      }),
    },
    afterDrain: (r) => {
      f.store.writeInbox({ eventId: "direct", topic: "parcel", payload: { type: "changed" } }, [
        "parcel-00",
      ]);
      r.schedule("parcel-00");
    },
  });
  cleanup.push(() => router.stop());
  expect(delivered).toBe(1);
  expect(f.store.pendingInbox("parcel-00")).toEqual([]);
});
it("combines old and new blueprint populations, keeps holders, and applies each version return point", async () => {
  const f = await fixture(single, {}, document("exit"));
  await f.start();
  const second = {
    key: blueprintVersionKey({ commit: "b".repeat(40), path }),
    document: document({ state: "open.lifecycle.packed" }),
  };
  f.versions.set(second.key, second);
  f.sources.set("b".repeat(40), single);
  await f.gates.revision(
    { blueprints: new Map([[path, second]]) },
    await f.revisionAt("b".repeat(40)),
  );
  f.store.saveSnapshot({ actorId: "parcel-new", machine: second.key, snapshot: snapshot() });
  const foreignKey = blueprintVersionKey({
    commit: "d".repeat(40),
    path: "blueprints/parcels/other.yml",
  });
  f.versions.set(foreignKey, { key: foreignKey, document: document() });
  f.store.saveSnapshot({
    actorId: "parcel-foreign",
    machine: blueprintVersionKey({ commit: "d".repeat(40), path: "blueprints/parcels/other.yml" }),
    snapshot: snapshot(),
  });
  await f.gates.prepare();
  f.gates.afterDrain({ schedule: () => {} });
  const evaluation = JSON.parse(String(f.rows("gates_evaluation").at(-1)?.["input"]));
  expect(evaluation.population.map((p: { id: string }) => p.id)).not.toContain("parcel-foreign");
  expect(evaluation.population.map((p: { id: string }) => p.id)).toContain("parcel-new");
  expect(evaluation.population.map((p: { id: string }) => p.id)).toContain("parcel-01");
  expect(evaluation.holders).toEqual([{ id: "parcel-00", item: "left" }]);
  f.save("parcel-00", "working");
  expect(f.rows("gates_token")[0]?.["return_reason"]).toBe("return-point");
  // Only the new actor can take the next grant.
  for (let i = 1; i < 20; i++)
    f.store.writeInbox({ eventId: "pending", topic: "parcel", payload: { type: "changed" } }, [
      `parcel-${String(i).padStart(2, "0")}`,
    ]);
  f.gates.afterDrain({ schedule: () => {} });
  expect(f.rows("gates_token")[1]?.["actor_id"]).toBe("parcel-new");
  f.gates.saved({
    actorId: "parcel-new",
    machine: second.key,
    snapshot: snapshot("working"),
    entries: {},
    entered: ["open.lifecycle.working"],
    activeInvokes: [],
  });
  expect(f.rows("gates_token")[1]?.["returned_at"]).toBeNull();
  f.gates.saved({
    actorId: "parcel-new",
    machine: second.key,
    snapshot: snapshot("packed"),
    entries: {},
    entered: ["open.lifecycle.packed"],
    activeInvokes: [],
  });
  expect(f.rows("gates_token")[1]?.["return_state"]).toBe("open.lifecycle.packed");
});
it("restores the last declaring comparator and reservation policy after removal without actors on that version", async () => {
  const f = await fixture(single, {}, document("exit", false));
  const secondCommit = "b".repeat(40),
    thirdCommit = "c".repeat(40);
  const second = {
    key: blueprintVersionKey({ commit: secondCommit, path }),
    document: document("exit", true),
  };
  f.versions.set(second.key, second);
  f.sources.set(
    secondCommit,
    `export default i => ({task:i.population.at(-1).id,reservations:[{account:'acct',amount:9}]});`,
  );
  await f.gates.revision(
    { blueprints: new Map([[path, second]]) },
    await f.revisionAt(secondCommit),
  );
  const removed = document();
  delete (
    removed.machine["states"] as {
      open: { states: { lifecycle: { states: { waiting: { meta?: unknown } } } } };
    }
  ).open.states.lifecycle.states.waiting.meta;
  const third = { key: blueprintVersionKey({ commit: thirdCommit, path }), document: removed };
  f.versions.set(third.key, third);
  await f.gates.revision({ blueprints: new Map([[path, third]]) }, await f.revisionAt(thirdCommit));
  f.gates.stop();
  const store = openStore({ path: join(f.dir, "store.sqlite") });
  cleanup.push(() => store.close());
  const ledger = createLedger({
    connection: store.connection,
    portfolio: parseLedgerPortfolio({
      items: [
        { id: "left", parent: null },
        { id: "right", parent: null },
      ],
      allocations: [
        { item: "left", account: "acct", guarantee: 50 },
        { item: "right", account: "acct", guarantee: 50 },
      ],
    }),
    now: () => 100,
  });
  const restored = createGates({
    ...f.options,
    store,
    portfolio: { ...f.options.portfolio, ledger },
  });
  cleanup.push(() => restored.stop());
  await restored.revision(
    { blueprints: new Map([[path, third]]) },
    await f.revisionAt(thirdCommit),
  );
  await restored.prepare();
  restored.afterDrain({ schedule: () => {} });
  expect(
    store.connection.database.prepare("SELECT version FROM gates_declaration").get()?.["version"],
  ).toBe(second.key);
  expect(
    store.connection.database
      .prepare("SELECT actor_id FROM gates_token ORDER BY evaluation_id LIMIT 1")
      .get()?.["actor_id"],
  ).toBe("parcel-19");
  expect(ledger.actorUsage("parcel-19").accounts[0]?.outstanding).toBe(9);
});
it("ignores reservations when disabled and rolls back a refused reservation with its token and inbox", async () => {
  const f = await fixture(oldest, {}, document("exit", false));
  await f.start();
  expect(f.ledger.actorUsage("parcel-00").accounts).toEqual([]);
  expect(f.store.pendingInbox("parcel-00")[0]?.payload).toMatchObject({ reservations: [] });
  const denied = await fixture(
    `export default i=>({task:i.population[0].id,reservations:[{account:'missing',amount:1}]});`,
  );
  await denied.start();
  expect(denied.rows("gates_token")).toEqual([]);
  expect(denied.store.pendingInbox("parcel-00")).toEqual([]);
  expect(denied.rows("gates_evaluation")).toHaveLength(1);
  expect(denied.rows("gates_evaluation")[0]?.["failure_kind"]).toBe("reservation");
  expect(denied.raised).toEqual([]);
});
it("records throws and timeouts, reevaluates after an input change, and stops cleanly", async () => {
  for (const body of [`throw new Error('example')`, `for (;;) {}`]) {
    const f = await fixture(`export default i=>{${body}}`);
    await f.start();
    expect(f.rows("gates_evaluation")[0]?.["outcome"]).toBe("failure");
    expect(["thrown", "timeout"]).toContain(f.rows("gates_evaluation")[0]?.["failure_kind"]);
    f.gates.inputChanged();
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(f.rows("gates_evaluation")).toHaveLength(2);
    f.gates.stop();
    expect(() => f.gates.inputChanged()).toThrow(TypeError);
  }
});
it("updates critical paths without a waiting actor save and terminates dependency cycles", async () => {
  const graph = new Map<
    string,
    {
      issue: { nodeId: string; state: "open" | "closed" };
      blocking: { nodeId: string; state: "open" | "closed" }[];
    }
  >([
    [
      "parcel-1",
      {
        issue: { nodeId: "parcel-1", state: "open" },
        blocking: [{ nodeId: "parcel-2", state: "open" }],
      },
    ],
    [
      "parcel-2",
      {
        issue: { nodeId: "parcel-2", state: "open" },
        blocking: [{ nodeId: "parcel-3", state: "open" }],
      },
    ],
    ["parcel-3", { issue: { nodeId: "parcel-3", state: "open" }, blocking: [] }],
  ]);
  const f = await fixture(`export default i=>null`, { trackedIssueIndex: () => new Map(graph) });
  await f.start();
  const length = () =>
    JSON.parse(String(f.rows("gates_evaluation").at(-1)?.["input"])).population[0].criticalPath;
  expect(length()).toBe(3);
  graph.get("parcel-3")!.blocking.push({ nodeId: "parcel-1", state: "open" });
  f.gates.inputChanged();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(length()).toBe(3);
  graph.get("parcel-2")!.blocking[0]!.state = "closed";
  f.gates.inputChanged();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(length()).toBe(2);
  graph.get("parcel-2")!.blocking[0]!.state = "open";
  graph.delete("parcel-3");
  f.gates.inputChanged();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(length()).toBe(2);
});
it("invalidates another gate after committed reservations without actor saves", async () => {
  const f = await fixture(single);
  const secondPath = "blueprints/parcels/dispatch.yml";
  const second = { key: blueprintVersionKey({ commit, path: secondPath }), document: document() };
  f.versions.set(second.key, second);
  await f.gates.revision(
    { blueprints: new Map([[secondPath, second]]) },
    await f.revisionAt(commit),
  );
  f.store.saveSnapshot({ actorId: "parcel-other", machine: second.key, snapshot: snapshot() });
  f.store.saveSnapshot({ actorId: "parcel-other-2", machine: second.key, snapshot: snapshot() });
  await f.start();
  const before = f
    .rows("gates_evaluation")
    .filter((e) => e["gate"] === `${secondPath}#open.lifecycle.waiting`).length;
  await new Promise<void>((resolve) => setImmediate(resolve));
  const evaluations = f
    .rows("gates_evaluation")
    .filter((e) => e["gate"] === `${secondPath}#open.lifecycle.waiting`);
  expect(evaluations.length).toBe(before + 1);
  expect(JSON.parse(String(evaluations.at(-1)?.["input"])).balances.left.acct).toBe(490);
});
it("reloads a spent sandbox only when the next input change requests a grant round", async () => {
  let loads = 0,
    failed = false;
  const f = await fixture(single, {
    sandbox: {
      load: async () => {
        loads++;
        return {
          ok: true,
          comparator: {
            dispose: () => {},
            evaluate: () => {
              if (!failed) {
                failed = true;
                return {
                  ok: false,
                  failure: { kind: "engine", message: "example engine failure" },
                  durationMs: 0,
                };
              }
              return { ok: true, selection: null, durationMs: 0 };
            },
          },
        };
      },
    },
  });
  await f.start();
  const loaded = loads;
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(loads).toBe(loaded);
  expect(f.rows("gates_evaluation")).toHaveLength(1);
  f.gates.inputChanged();
  await expect.poll(() => f.rows("gates_evaluation").length).toBe(2);
  expect(loads).toBe(loaded + 1);
});
it("does not grant with missing comparator source and resumes on a later declaring revision", async () => {
  const f = await fixture(single, {
    revisionAt: async () => ({ commit, read: async () => undefined }),
  });
  await f.gates.prepare();
  f.gates.afterDrain({ schedule: () => {} });
  expect(f.rows("gates_token")).toEqual([]);
  expect(f.errors).not.toEqual([]);
  await f.gates.revision(
    { blueprints: new Map([[path, f.blueprint]]) },
    await f.revisionAt(commit),
  );
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(f.rows("gates_token")).toHaveLength(1);
});
it("grants existing actors when a live revision first introduces a gate without an actor save", async () => {
  const f = await fixture(single);
  // Resume with the original declaration absent. A later revision gates the existing state.
  f.gates.stop();
  f.store.connection.database.exec("DELETE FROM gates_declaration");
  const gates = createGates(f.options);
  cleanup.push(() => gates.stop());
  await gates.prepare();
  gates.afterDrain({ schedule: () => {} });
  await gates.revision({ blueprints: new Map([[path, f.blueprint]]) }, await f.revisionAt(commit));
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(f.rows("gates_token")).toHaveLength(1);
});
it("withdraws the escalation when a token returns after its actor has left a trap", async () => {
  const f = await fixture(single, {
    lintTokens: () => ({
      configurations: 1,
      gates: [
        {
          statePath: "open.lifecycle.waiting",
          verdict: "potential",
          location: "",
          findings: [],
          traps: new Set([JSON.stringify(snapshot("working").value)]),
        },
      ],
      configurationKey: (s) => JSON.stringify((s as unknown as { value: unknown }).value),
    }),
  });
  await f.start();
  f.save("parcel-00", "working");
  expect(f.raised).toHaveLength(1);
  f.save("parcel-00", "shipped");
  expect(f.rows("gates_token")[0]?.["trapped"]).toBe(0);
  f.save("parcel-00", "shipped", [], "entry-1", "done");
  expect(f.withdrawn.filter((e) => e.kind === "stranded-token")).toHaveLength(1);
});
it("excludes a holder after a new state entry and an entry whose token was already returned", async () => {
  const f = await fixture(single);
  await f.start();
  const token = String(f.rows("gates_token")[0]?.["token_id"]);
  f.store.markConsumed("parcel-00", `gate:${token}`);
  f.save("parcel-00", "waiting", ["open.lifecycle.waiting"], "next-entry");
  f.gates.afterDrain({ schedule: () => {} });
  const input = JSON.parse(String(f.rows("gates_evaluation").at(-1)?.["input"]));
  expect(input.population.map((p: { id: string }) => p.id)).not.toContain("parcel-00");
  const g = await fixture(single);
  await g.start();
  const first = String(g.rows("gates_token")[0]?.["token_id"]);
  g.store.markConsumed("parcel-00", `gate:${first}`);
  g.store.connection.transaction(() =>
    g.gates.strandedToken(answered({ gate, tokenId: first }, { choice: "return" })),
  );
  g.gates.afterDrain({ schedule: () => {} });
  expect(g.rows("gates_token").map((r) => r["actor_id"])).toEqual(["parcel-00", "parcel-01"]);
});
it("does not return exit tokens on an error save and returns every held token on an unknown version end", async () => {
  const f = await fixture(single, {}, document("exit"));
  await f.start();
  f.gates.saved({
    actorId: "parcel-00",
    machine: f.blueprint.key,
    snapshot: { status: "error" },
    entered: [],
    entries: {},
    activeInvokes: [],
  });
  expect(f.rows("gates_token")[0]?.["returned_at"]).toBeNull();
  f.gates.saved({
    actorId: "parcel-00",
    machine: `${"f".repeat(40)}:${path}`,
    snapshot: snapshot("waiting", "done"),
    entered: [],
    entries: {},
    activeInvokes: [],
  });
  expect(f.rows("gates_token")[0]?.["return_reason"]).toBe("ended");
  expect(f.errors).toHaveLength(1);
});
it("returns every gate token held by one actor when it ends", async () => {
  const doc = document();
  const open = doc.machine["states"] as {
    open: { states: { slot: { states: { free: Record<string, unknown> } } } };
  };
  open.open.states.slot.states.free["meta"] = {
    gate: {
      comparator: "comparators/order.ts",
      return: { state: "open.lifecycle.packed" },
      token: "other-slot",
    },
  };
  const f = await fixture(single, {}, doc);
  await f.start();
  for (const token of f.rows("gates_token"))
    f.store.markConsumed(String(token["actor_id"]), `gate:${token["token_id"]}`);
  expect(f.rows("gates_token").map((t) => t["actor_id"])).toEqual(["parcel-00", "parcel-01"]);
  for (let i = 2; i < 20; i++)
    f.store.writeInbox({ eventId: "pending", topic: "parcel", payload: { type: "changed" } }, [
      `parcel-${String(i).padStart(2, "0")}`,
    ]);
  f.save("parcel-01", "working", [], "entry-1", "done");
  f.gates.afterDrain({ schedule: () => {} });
  expect(
    f.rows("gates_token").filter((t) => t["actor_id"] === "parcel-00" && t["returned_at"] === null),
  ).toHaveLength(2);
  f.save("parcel-00", "working", [], "entry-1", "done");
  expect(
    f
      .rows("gates_token")
      .filter((t) => t["actor_id"] === "parcel-00")
      .every((t) => t["return_reason"] === "ended"),
  ).toBe(true);
});
it("uses reservable balances, snapshot fields, dependency state, and nonnegative whole ages", async () => {
  const f = await fixture(`export default i=>null`, { clock: { now: () => 50 } });
  const balance = f.options.portfolio.ledger.balance.bind(f.options.portfolio.ledger);
  f.options.portfolio.ledger.balance = (query) => ({
    ...balance(query),
    available: 99,
    reservable: 17,
  });
  f.store.saveSnapshot({
    actorId: "parcel-00",
    machine: f.blueprint.key,
    snapshot: {
      ...snapshot(),
      value: { open: { lifecycle: "waiting", dependencies: "blocked", slot: "free" } },
      context: { fields: { size: 4 }, manifold: { portfolioItem: "left" } },
    },
  });
  await f.start();
  const input = JSON.parse(String(f.rows("gates_evaluation")[0]?.["input"]));
  expect(input.balances.left.acct).toBe(17);
  expect(input.population[0]).toMatchObject({
    fields: { size: 4 },
    dependencies: "blocked",
    age: 0,
    criticalPath: 1,
    item: "left",
  });
});
it("dismisses and ignores stale or mismatched escalation answers without returning a token", async () => {
  const f = await fixture(single);
  await f.start();
  const token = String(f.rows("gates_token")[0]?.["token_id"]);
  for (const escalation of [
    { subject: { gate, tokenId: token }, answer: { choice: "dismiss" } },
    { subject: { gate: "other", tokenId: token }, answer: { choice: "return" } },
    { subject: { gate, tokenId: "absent" }, answer: { choice: "return" } },
    { subject: { gate, tokenId: token }, answer: { text: "example" } },
    { subject: { gate, tokenId: token }, answer: undefined },
  ])
    expect(f.gates.strandedToken(answered(escalation.subject, escalation.answer))).toBeUndefined();
  expect(f.rows("gates_token")[0]?.["returned_at"]).toBeNull();
});
it("records canonical input JSON regardless of snapshot field insertion order", async () => {
  const f = await fixture(`export default i=>null`);
  f.store.saveSnapshot({
    actorId: "parcel-00",
    machine: f.blueprint.key,
    snapshot: {
      ...snapshot(),
      context: { ...snapshot().context, fields: { z: 1, a: { z: 2, a: 3 }, "10": 9, "2": 10 } },
    },
  });
  await f.start();
  const first = f.rows("gates_evaluation")[0]?.["input"];
  expect(first).toContain('"fields":{"10":9,"2":10,');
  f.store.saveSnapshot({
    actorId: "parcel-00",
    machine: f.blueprint.key,
    snapshot: {
      ...snapshot(),
      context: { ...snapshot().context, fields: { a: { a: 3, z: 2 }, z: 1, "2": 10, "10": 9 } },
    },
  });
  f.gates.inputChanged();
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(f.rows("gates_evaluation").at(-1)?.["input"]).toBe(first);
});
it("replays seeded selections with canonical fields in the same enumeration order", async () => {
  const f = await fixture(
    `export default i=>({task:i.population[Math.floor(i.random()*i.population.length)].id});`,
    { seed: () => 1234 },
  );
  await f.start();
  for (const row of f.rows("gates_evaluation")) {
    expect(row["seed"]).toBe(1234);
    const replay = await f.gates.replay(Number(row["evaluation_id"]));
    expect(replay.replayed.ok && replay.replayed.selection).toEqual(
      replay.recorded.ok && replay.recorded.selection,
    );
  }
  const order = await fixture(
    `export default i=>({task:Object.keys(i.population[0].fields)[0]==='a'?i.population[0].id:i.population.at(-1).id});`,
  );
  order.store.saveSnapshot({
    actorId: "parcel-00",
    machine: order.blueprint.key,
    snapshot: { ...snapshot(), context: { ...snapshot().context, fields: { z: 1, a: 2 } } },
  });
  await order.start();
  const replay = await order.gates.replay(
    Number(order.rows("gates_evaluation")[0]?.["evaluation_id"]),
  );
  expect(replay.replayed.ok && replay.replayed.selection).toEqual(
    replay.recorded.ok && replay.recorded.selection,
  );
});
it("restores trap flags without reraising and ignores trap sets for unknown lint verdicts", async () => {
  const f = await fixture(single, {
    lintTokens: () => ({
      configurations: 1,
      gates: [
        {
          statePath: "open.lifecycle.waiting",
          verdict: "potential",
          location: "",
          findings: [],
          traps: new Set(["trap"]),
        },
      ],
      configurationKey: () => "trap",
    }),
  });
  await f.start();
  f.save("parcel-00", "working");
  f.gates.stop();
  const store = openStore({ path: join(f.dir, "store.sqlite") });
  cleanup.push(() => store.close());
  const restored = createGates({ ...f.options, store });
  cleanup.push(() => restored.stop());
  await restored.prepare();
  store.connection.transaction(() =>
    restored.saved({
      actorId: "parcel-00",
      machine: f.blueprint.key,
      snapshot: snapshot("working"),
      activeInvokes: [],
      entered: [],
      entries: {},
    }),
  );
  expect(f.raised).toHaveLength(1);
  const unknown = await fixture(single, {
    lintTokens: () => ({
      configurations: 1,
      gates: [
        {
          statePath: "open.lifecycle.waiting",
          verdict: "unknown",
          location: "",
          findings: [],
          traps: new Set(["trap"]),
        },
      ],
      configurationKey: () => "trap",
    }),
  });
  await unknown.start();
  unknown.save("parcel-00", "working");
  expect(unknown.raised).toEqual([]);
  expect(unknown.rows("gates_token")[0]?.["returned_at"]).toBeNull();
});

it("discards a spent-engine reload that loses to a newer declaring revision", async () => {
  let loads = 0;
  let release!: () => void;
  let entered!: () => void;
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const disposed: number[] = [];
  const f = await fixture("old", {
    sandbox: {
      load: async ({ text }) => {
        const id = ++loads;
        const loaded: ComparatorLoad = {
          ok: true,
          comparator: {
            dispose: () => {
              disposed.push(id);
            },
            evaluate: (input) =>
              id === 2
                ? {
                    ok: false,
                    failure: { kind: "engine", message: "example failure" },
                    durationMs: 0,
                  }
                : {
                    ok: true,
                    selection: input.holders.length
                      ? null
                      : {
                          task: (text === "new" ? input.population.at(-1)! : input.population[0]!)
                            .id,
                          reservations: [{ account: "acct", amount: text === "new" ? 7 : 5 }],
                        },
                    durationMs: 0,
                  },
          },
        };
        if (id !== 3) return loaded;
        const pending = new Promise<void>((resolve) => {
          release = resolve;
        });
        entered();
        await pending;
        return loaded;
      },
    },
  });
  await f.start();
  f.gates.inputChanged();
  await reached;
  const nextCommit = "b".repeat(40);
  const next = { key: blueprintVersionKey({ commit: nextCommit, path }), document: document() };
  f.versions.set(next.key, next);
  await f.gates.revision(
    { blueprints: new Map([[path, next]]) },
    { commit: nextCommit, read: async () => "new" },
  );
  release();
  await expect.poll(() => f.rows("gates_token").length).toBe(1);
  expect(f.rows("gates_token")[0]?.["actor_id"]).toBe("parcel-19");
  expect(
    f.rows("gates_evaluation").find((row) => row["outcome"] === "selection")?.["version"],
  ).toBe(next.key);
  expect(f.ledger.balance({ item: "left", account: "acct", waiting: ["left"] }).outstanding).toBe(
    7,
  );
  expect(disposed).toContain(3);
  expect(disposed).not.toContain(4);
  f.gates.stop();
  expect(disposed.toSorted()).toEqual([1, 2, 3, 4]);
});

it("keeps the mapped comparator alive until its replacement finishes loading", async () => {
  let loads = 0;
  let release!: () => void;
  let entered!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reached = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const disposed: number[] = [];
  const f = await fixture(single, {
    sandbox: {
      load: async () => {
        const id = ++loads;
        return {
          ok: true,
          comparator: {
            dispose: () => {
              disposed.push(id);
            },
            evaluate: () => ({ ok: true, selection: null, durationMs: 0 }),
          },
        };
      },
    },
  });
  await f.start();
  const nextCommit = "b".repeat(40);
  const next = { key: blueprintVersionKey({ commit: nextCommit, path }), document: document() };
  const replacing = f.gates.revision(
    { blueprints: new Map([[path, next]]) },
    {
      commit: nextCommit,
      read: async () => {
        entered();
        await blocked;
        return single;
      },
    },
  );
  await reached;
  expect(disposed).toEqual([1]);
  release();
  await replacing;
  expect(disposed).toEqual([1, 2]);
  f.gates.stop();
  expect(disposed).toEqual([1, 2, 3]);
});

function answered(
  subject: Readonly<Record<string, string>>,
  value: { choice: string } | { text: string } | undefined,
) {
  return {
    raiser: { type: "service" as const, kind: "stranded-token" as const, subject, occurrence: 1 },
    ...(value ? { answer: { value, channel: "api" as const, at: 100 } } : {}),
  };
}

it("raises comparator failures once through raise and retries only the named gate", async () => {
  const f = await fixture('export default () => { throw new Error("bad parcel order"); }');
  f.gates.afterDrain({ schedule: () => {} });
  expect(f.raised).toMatchObject([
    { kind: "comparator-failed", subject: { gate }, title: "Comparator failed" },
  ]);
  const count = f.store.connection.database
    .prepare("SELECT count(*) AS n FROM gates_evaluation")
    .get()?.["n"];
  f.gates.comparatorFailed({
    raiser: { type: "service", kind: "comparator-failed", subject: { gate }, occurrence: 1 },
    answer: { value: { choice: "dismiss" }, channel: "api", at: 100 },
  });
  await new Promise((resolve) => setImmediate(resolve));
  expect(
    f.store.connection.database.prepare("SELECT count(*) AS n FROM gates_evaluation").get()?.["n"],
  ).toBe(count);
  const retry = f.gates.comparatorFailed({
    raiser: { type: "service", kind: "comparator-failed", subject: { gate }, occurrence: 1 },
    answer: { value: { choice: "retry" }, channel: "api", at: 100 },
  });
  retry?.();
  await new Promise((resolve) => setImmediate(resolve));
  expect(f.raised).toHaveLength(2);
});

it("contains a rejected comparator retry at its fire-and-forget boundary", async () => {
  const f = await fixture("export default 12;", {
    revisionAt: async () => {
      throw new Error("revision read failed");
    },
  });
  const retry = f.gates.comparatorFailed({
    raiser: { type: "service", kind: "comparator-failed", subject: { gate }, occurrence: 1 },
    answer: { value: { choice: "retry" }, channel: "api", at: 100 },
  });
  retry?.();
  await new Promise((resolve) => setImmediate(resolve));
  expect(f.errors).toContainEqual(
    expect.objectContaining({ gate, message: "Error: revision read failed" }),
  );
});

it("rolls evaluation back when raising its comparator escalation fails", async () => {
  const f = await fixture('export default () => { throw new Error("bad order"); }', {
    escalations: {
      withdraw: () => {},
      raise: () => {
        throw new Error("database fault");
      },
    },
  });
  expect(() => f.gates.afterDrain({ schedule: () => {} })).toThrow("database fault");
  expect(f.rows("gates_evaluation")).toEqual([]);
  expect(f.rows("gates_token")).toEqual([]);
});

it("reads a token holder before and after return, and no holder for an unknown token", async () => {
  const f = await fixture(single);
  await f.start();
  const token = String(f.rows("gates_token")[0]!["token_id"]);
  expect(f.gates.tokenHolder(token)).toBe("parcel-00");
  expect(f.gates.tokenHolder("unknown")).toBeUndefined();
  f.save("parcel-00", "shipped", [], "entry-1", "done");
  expect(f.rows("gates_token")[0]!["returned_at"]).not.toBeNull();
  expect(f.gates.tokenHolder(token)).toBe("parcel-00");
});

it.each([10, 1000])(
  "one mirror read supplies every evaluation of a grant round with %i issues",
  async (size) => {
    const f = await fixture(
      `export default i => i.holders.length >= 5 ? null : {task: [...i.population].sort((a,b) => b.criticalPath-a.criticalPath || a.id.localeCompare(b.id))[0].id};`,
      {},
      document("exit", false),
    );
    const { mirror, bound } = trackedMirror(f.store, size);
    f.options.trackedIssueIndex = () => mirror.trackedIssueIndex(bound);
    const before = mirror.read(),
      after = mirror.read();
    for (const [from, to] of [
      ["parcel-1", "parcel-0"],
      ["parcel-2", "parcel-1"],
      ["parcel-4", "parcel-3"],
      ["parcel-3", "parcel-4"],
      ["parcel-9", "parcel-0"],
    ])
      after.dependencies.set(`${from}:${to}`, { from: from!, to: to!, present: true, revision: 0 });
    after.items.get("parcel-9")!.present = false;
    mirror.write(before, after);
    for (let i = 0; i < size + 2; i++)
      f.store.saveSnapshot({
        actorId: `member-${String(i).padStart(4, "0")}`,
        machine: f.blueprint.key,
        snapshot: {
          ...snapshot(),
          context: {
            manifold: {
              portfolioItem: "left",
              ...(i === size ? {} : { issue: i === size + 1 ? "unknown" : `parcel-${i}` }),
            },
          },
        },
      });
    // Existing fixture members name parcel-1; move them out of the population.
    for (let i = 0; i < 20; i++) f.save(`parcel-${String(i).padStart(2, "0")}`, "working");
    const prepare = vi.spyOn(f.store.connection.database, "prepare");
    await f.start();
    expect(prepare.mock.calls.filter(([sql]) => sql === "SELECT * FROM github_issue")).toHaveLength(
      1,
    );
    prepare.mockRestore();
    const inputs = f.rows("gates_evaluation").map(
      (row) =>
        JSON.parse(String(row["input"])) as {
          population: { id: string; criticalPath: number }[];
        },
    );
    expect(inputs).toHaveLength(6);
    for (const input of inputs.slice(1))
      for (const member of input.population)
        expect(member.criticalPath).toBe(
          inputs[0]!.population.find((m) => m.id === member.id)!.criticalPath,
        );
    const lengths = new Map(inputs[0]!.population.map((m) => [m.id, m.criticalPath]));
    for (let i = 0; i < size + 2; i++)
      expect(lengths.get(`member-${String(i).padStart(4, "0")}`)).toBe(
        i === 0 ? 3 : [1, 3, 4].includes(i) ? 2 : 1,
      );
    expect(f.scheduled).toEqual([
      "member-0000",
      "member-0001",
      "member-0003",
      "member-0004",
      "member-0002",
    ]);
    const changed = mirror.read();
    const row = changed.issues.get("parcel-2")!;
    row.issue = { ...row.issue, state: "closed" };
    mirror.write(after, changed);
    f.store.saveSnapshot({ actorId: "later", machine: f.blueprint.key, snapshot: snapshot() });
    // The comparator keeps the next population waiting once five tokens are held.
    f.gates.inputChanged();
    const next = vi.spyOn(f.store.connection.database, "prepare");
    await new Promise<void>((resolve) => setImmediate(resolve));
    const latest = JSON.parse(String(f.rows("gates_evaluation").at(-1)?.["input"])) as {
      population: { id: string; criticalPath: number }[];
    };
    expect(latest.population.find((m) => m.id === "later")?.criticalPath).toBe(1);
    expect(next.mock.calls.filter(([sql]) => sql === "SELECT * FROM github_issue")).toHaveLength(1);
    next.mockRestore();
  },
);

it("a grant round with no issue identities does not read the mirror", async () => {
  const f = await fixture("export default i=>null");
  const { mirror, bound } = trackedMirror(f.store, 10);
  f.options.trackedIssueIndex = () => mirror.trackedIssueIndex(bound);
  for (let i = 0; i < 20; i++)
    f.store.saveSnapshot({
      actorId: `parcel-${String(i).padStart(2, "0")}`,
      machine: f.blueprint.key,
      snapshot: { ...snapshot(), context: { manifold: { portfolioItem: "left" } } },
    });
  const prepare = vi.spyOn(f.store.connection.database, "prepare");
  await f.start();
  expect(prepare.mock.calls.filter(([sql]) => sql === "SELECT * FROM github_issue")).toHaveLength(
    0,
  );
  prepare.mockRestore();
  const input = JSON.parse(String(f.rows("gates_evaluation")[0]?.["input"])) as {
    population: { criticalPath: number }[];
  };
  expect(input.population.map((m) => m.criticalPath)).toEqual(Array(20).fill(1));
});
