// ---
// relationships:
//   verifies: blueprint-migration
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { fromCallback, fromPromise } from "xstate";
import type { ActorHostOptions, SaveHook } from "../actor-host/index.ts";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import { stringify } from "yaml";
import { configureBlueprintExpressions } from "../blueprint-expressions.ts";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { createBlueprintLoader } from "../blueprint-loader/index.ts";
import { openStore } from "../store/index.ts";
import { openActorHost, recordStateEntry, invocationOf } from "../actor-host/index.ts";
import { startRouter } from "../router/index.ts";
import { openMigrations } from "./index.ts";
const path = "blueprints/parcel.yml",
  a = "a".repeat(40),
  b = "b".repeat(40);
const old = {
  machine: {
    id: "parcel",
    initial: "waiting",
    context: { depot: "north" },
    states: {
      waiting: { on: { scanned: "delivered" }, after: { 100000: "delivered" } },
      delivered: { type: "final" },
    },
  },
  schemas: {
    input: true,
    output: true,
    context: { type: "object", required: ["depot"], properties: { depot: { type: "string" } } },
    events: { scanned: true },
  },
};
const next = () => ({
  ...old,
  schemas: {
    ...old.schemas,
    context: { type: "object", required: ["zone"], properties: { zone: { type: "string" } } },
  },
  migrations: [
    {
      from: old.schemas.context,
      context: { type: "expression.map", params: { expression: '{"zone": context.depot}' } },
    },
  ],
});
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  configureBlueprintExpressions();
  for (const fn of cleanup.splice(0).toReversed()) await fn();
});
async function fixture(
  document: Record<string, unknown> = next(),
  options: {
    original?: Record<string, unknown>;
    hooks?: SaveHook[];
    heldTokens?: ActorHostOptions["heldTokens"];
    implementations?: Partial<ImplementationRegistry>;
    ancestor?: boolean;
    oldFiles?: Record<string, string>;
    newFiles?: Record<string, string>;
  } = {},
) {
  // A loaded cold worker expires the simple migration mapping at 1000 ms.
  configureBlueprintExpressions({ timeoutMs: 10000 });
  const directory = mkdtempSync(join(tmpdir(), "migration-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const store = openStore({ path: join(directory, "store.sqlite") });
  cleanup.push(() => store.close());
  const revisions = new Map([
    [a, memoryRevision(a, { [path]: stringify(options.original ?? old), ...options.oldFiles })],
    [b, memoryRevision(b, { [path]: stringify(document), ...options.newFiles })],
  ]);
  const loader = createBlueprintLoader({
    implementations: {
      actors: {},
      actions: {},
      guards: {},
      delays: {},
      ...options.implementations,
    },
    revisionAt: async (commit) => revisions.get(commit),
    onExpressionError: () => {},
    onStateEntry: recordStateEntry,
  });
  const first = await loader.version({ commit: a, path });
  if (first.status !== "loaded") throw new Error(JSON.stringify(first));
  store.saveSnapshot({
    actorId: "other",
    machine: first.blueprint.key,
    snapshot: { status: "done", value: "delivered", context: {} },
  });
  const host = await openActorHost({
    store,
    blueprints: loader,
    saveHooks: options.hooks ?? [],
    log: () => {},
    ...(options.heldTokens ? { heldTokens: options.heldTokens } : {}),
  });
  const router = startRouter({ store, host });
  cleanup.push(() => router.stop());
  host.start({
    actorId: "parcel",
    blueprint: first.blueprint,
    input: { manifold: { issue: "parcel-node" } },
  });
  let latest = await loader.loadRevision(revisions.get(b)!);
  const raised: unknown[] = [],
    logs: unknown[] = [];
  const migrations = openMigrations({
    store,
    actorHost: host,
    latest: () => latest,
    isAncestor: async (from, to) => options.ancestor !== false && from === a && to !== a,
    bundles: { recordedAt: () => undefined },
    escalations: {
      list: () => [],
      raise: (request) => {
        raised.push(request);
        return {} as never;
      },
      withdraw: () => {},
    },
    log: (entry) => logs.push(entry),
  });
  cleanup.push(() => migrations.stop());
  return {
    store,
    host,
    router,
    migrations,
    latest,
    raised,
    logs,
    loader,
    first,
    revisions,
    setLatest: (revision: typeof latest) => {
      latest = revision;
    },
  };
}
test("migrates a waiting actor once through its ordinary save, preserving entries and deadlines", async () => {
  const f = await fixture();
  const before = f.store.loadSnapshot("parcel")!;
  const deadlines = f.store.connection.database.prepare("SELECT * FROM store_deadline").all();
  expect(await f.migrations.run()).toMatchObject({ migrated: ["parcel"] });
  expect(f.store.loadSnapshot("parcel")).toMatchObject({
    machine: `${b}:${path}`,
    snapshot: { value: "waiting", context: { zone: "north" }, entries: before.snapshot["entries"] },
  });
  expect(f.store.connection.database.prepare("SELECT * FROM store_deadline").all()).toEqual(
    deadlines,
  );
  expect(await f.migrations.run()).toEqual({ migrated: [], deferred: [], failed: [] });
  f.router.publish({
    source: "github",
    eventId: "scan",
    topics: ["github.issue.parcel-node"],
    event: { type: "scanned" },
  });
});
test("records a refused mapping once while leaving the saved snapshot and deadlines identical", async () => {
  const document = next();
  // The mapping passes lint samples, but rejects this actor's concrete depot.
  document.migrations[0]!.context.params.expression =
    'context.depot = "north" ? $error("refused") : {"zone": context.depot}';
  const f = await fixture(document),
    before = f.store.loadSnapshot("parcel");
  expect(await f.migrations.run()).toMatchObject({ failed: [{ kind: "mapping-failed" }] });
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
  expect(await f.migrations.run()).toEqual({ migrated: [], deferred: [], failed: [] });
  expect(f.raised).toHaveLength(1);
  expect(f.store.migrationFailure("parcel")).toMatchObject({
    from: `${a}:${path}`,
    to: `${b}:${path}`,
    kind: "mapping-failed",
  });
});

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
test("uses mapped context and the new event subscription, and keeps the actor identity", async () => {
  const document = next();
  document.machine = {
    ...old.machine,
    states: {
      waiting: {
        on: {
          scanned: {
            target: "delivered",
            guard: { type: "expression.guard", params: { expression: 'context.zone = "north"' } },
          },
        },
      },
      delivered: { type: "final" },
    },
  } as unknown as typeof document.machine;
  const f = await fixture(document);
  const identity = (f.store.loadSnapshot("parcel")!.snapshot["context"] as Record<string, unknown>)[
    "manifold"
  ];
  await f.migrations.run();
  expect(
    (f.store.loadSnapshot("parcel")!.snapshot["context"] as Record<string, unknown>)["manifold"],
  ).toEqual(identity);
  const accepted = f.router.publish({
    source: "github",
    eventId: "scan",
    topics: ["github.issue.parcel-node"],
    event: { type: "scanned" },
  });
  expect(accepted).toMatchObject({
    status: "accepted",
    rows: [expect.objectContaining({ actorId: "parcel" })],
  });
  await settle();
  expect(f.store.loadSnapshot("parcel")!.snapshot).toMatchObject({
    status: "done",
    value: "delivered",
  });
});
test.each([
  ["context-rejected", 'context.depot = "north" ? {"zone": 42} : {"zone": context.depot}'],
  ["mapping-failed", 'context.depot = "north" ? {"manifold": {}} : {"zone": context.depot}'],
])("contains %s and still takes the next event on the old version", async (kind, expression) => {
  const document = next();
  document.migrations[0]!.context.params.expression = expression;
  const f = await fixture(document),
    before = f.store.loadSnapshot("parcel"),
    deadlines = f.store.connection.database.prepare("SELECT * FROM store_deadline").all();
  await f.migrations.run();
  await f.migrations.run();
  expect(f.store.migrationFailure("parcel")!.kind).toBe(kind);
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
  expect(f.store.connection.database.prepare("SELECT * FROM store_deadline").all()).toEqual(
    deadlines,
  );
  expect(f.raised).toHaveLength(1);
  f.router.publish({
    source: "github",
    eventId: "scan",
    topics: ["github.issue.parcel-node"],
    event: { type: "scanned" },
  });
  await settle();
  expect(f.store.loadSnapshot("parcel")).toMatchObject({
    machine: `${a}:${path}`,
    snapshot: { status: "done" },
  });
});
test.each([
  ["version-invalid", { ...next(), machine: { initial: "absent", states: { waiting: {} } } }],
  [
    "restore-mismatch",
    {
      ...next(),
      machine: {
        initial: "packing",
        context: {},
        states: { packing: {}, delivered: { type: "final" } },
      },
    },
  ],
  ["no-path", { ...next(), migrations: [] }],
])("refuses %s without changing the old snapshot", async (kind, document) => {
  const f = await fixture(document),
    before = f.store.loadSnapshot("parcel");
  await f.migrations.run();
  await f.migrations.run();
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
  expect(f.store.migrationFailure("parcel"), JSON.stringify([...f.latest.failures])).toMatchObject({
    kind,
  });
  expect(f.raised).toHaveLength(kind === "version-invalid" ? 0 : 1);
});
test("does not migrate an actor on unrelated history", async () => {
  const f = await fixture(next(), { ancestor: false });
  expect(await f.migrations.run()).toEqual({ migrated: [], deferred: [], failed: [] });
  expect(f.store.loadSnapshot("parcel")!.machine).toBe(`${a}:${path}`);
});
test("defers pending events and migrates after their committed save", async () => {
  const original = {
    ...old,
    machine: {
      ...old.machine,
      states: { ...old.machine.states, waiting: { on: { scanned: {} } } },
    },
  };
  const f = await fixture(next(), { original });
  f.router.publish({
    source: "github",
    eventId: "scan",
    topics: ["github.issue.parcel-node"],
    event: { type: "scanned" },
  });
  const target = f.latest.blueprints.get(path)!;
  expect(await f.host.migrate("parcel", target)).toEqual({
    status: "deferred",
    reason: "pending-events",
  });
  await expect.poll(() => f.store.loadSnapshot("parcel")!.machine).toBe(target.key);
  expect(
    f.logs.filter((entry) => (entry as { event: string }).event === "actor-migrated"),
  ).toHaveLength(1);
});
test("a failed save rolls back every hook and never stops the old callback", async () => {
  const invocations: unknown[] = [];
  let database: import("node:sqlite").DatabaseSync;
  let stopCount = 0,
    starts = 0,
    reject = false;
  const original = {
    ...old,
    machine: {
      ...old.machine,
      states: {
        ...old.machine.states,
        waiting: { invoke: { id: "watch", src: "watch" }, on: { scanned: "delivered" } },
      },
    },
  };
  const document = { ...next(), machine: original.machine };
  const f = await fixture(document, {
    original,
    implementations: {
      actorKinds: { watch: "callback" },
      actors: {
        watch: fromCallback((args) => {
          invocations.push(invocationOf(args));
          starts++;
          return () => {
            stopCount++;
          };
        }),
      },
    },
    hooks: [
      () => {
        if (reject) {
          database.exec("INSERT INTO test_hook VALUES (1)");
          throw new Error("write refused");
        }
      },
    ],
  });
  database = f.store.connection.database;
  database.exec("CREATE TABLE test_hook (value INTEGER)");
  const before = f.store.loadSnapshot("parcel");
  reject = true;
  expect(await f.host.migrate("parcel", f.latest.blueprints.get(path)!)).toMatchObject({
    status: "failed",
    failure: { kind: "store" },
  });
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
  expect(starts).toBe(1);
  expect(stopCount).toBe(0);
  expect(database.prepare("SELECT * FROM test_hook").all()).toEqual([]);
  reject = false;
  expect(await f.host.migrate("parcel", f.latest.blueprints.get(path)!)).toMatchObject({
    status: "migrated",
  });
  expect(starts).toBe(2);
  expect(stopCount).toBe(1);
  expect(invocations).toHaveLength(2);
  expect(invocations[1]).toEqual(invocations[0]);
});
test("defers active promises and migrates once their completion is saved", async () => {
  let resolve!: () => void;
  const pending = new Promise<void>((done) => {
    resolve = done;
  });
  const original = {
    ...old,
    machine: {
      ...old.machine,
      states: { ...old.machine.states, waiting: { invoke: { id: "work", src: "work" } } },
    },
  };
  const f = await fixture(
    { ...next(), machine: original.machine },
    {
      original,
      implementations: {
        actorKinds: { work: "promise" },
        actors: { work: fromPromise(() => pending) },
      },
    },
  );
  expect(await f.migrations.run()).toMatchObject({ deferred: ["parcel"] });
  resolve();
  await expect.poll(() => f.store.loadSnapshot("parcel")!.machine).toBe(`${b}:${path}`);
});
test("a held gate missing in the target refuses migration", async () => {
  const f = await fixture(next(), {
    heldTokens: () => [{ gate: `${path}#waiting`, tokenId: "token-one" }],
  });
  const before = f.store.loadSnapshot("parcel");
  expect(await f.migrations.run()).toMatchObject({ failed: [{ kind: "gate-missing" }] });
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
});

test.each(["state", "exit"])(
  "refuses a target that would return a held token at %s",
  async (mode) => {
    const gate = {
      comparator: "comparators/order.ts",
      return: mode === "exit" ? "exit" : { state: "waiting" },
    };
    const machine = {
      ...old.machine,
      states: {
        ...old.machine.states,
        queued: { meta: { gate }, on: { "token.granted": "waiting" } },
      },
    };
    const f = await fixture(
      { ...next(), machine },
      { heldTokens: () => [{ gate: `${path}#queued`, tokenId: "token-one" }] },
    );
    expect(f.latest.failures.size).toBe(0);
    const before = f.store.loadSnapshot("parcel");
    expect(await f.migrations.run()).toMatchObject({ failed: [{ kind: "token-return" }] });
    expect(f.store.loadSnapshot("parcel")).toEqual(before);
  },
);
test("retry clears the version failures and runs its jobs after the answer commits", async () => {
  const document = next();
  document.migrations[0]!.context.params.expression =
    'context.depot = "north" ? $error("refused") : {"zone": context.depot}';
  const f = await fixture(document);
  await f.migrations.run();
  const answer = {
    raiser: { type: "service", kind: "migration-failed", subject: { version: `${b}:${path}` } },
    answer: { value: { choice: "retry" } },
  } as unknown as import("../escalations/index.ts").Escalation;
  const effect = f.store.connection.transaction(() => f.migrations.migrationFailed(answer));
  expect(f.store.migrationFailures(`${b}:${path}`)).toEqual([]);
  expect(f.raised).toHaveLength(1);
  effect!();
  await expect.poll(() => f.raised.length).toBe(2);
});
test("dismiss keeps the failed pair and stops repeated attempts", async () => {
  const f = await fixture({ ...next(), migrations: [] });
  await f.migrations.run();
  expect(
    f.migrations.migrationFailed({
      raiser: { type: "service", kind: "migration-failed", subject: { version: `${b}:${path}` } },
      answer: { value: { choice: "dismiss" } },
    } as unknown as import("../escalations/index.ts").Escalation),
  ).toBeUndefined();
  await f.migrations.run();
  f.router.persist("parcel");
  await settle();
  await f.migrations.stop();
  expect(f.raised).toHaveLength(1);
  expect(f.store.migrationFailures(`${b}:${path}`)).toHaveLength(1);
});

test("maps an active child blueprint context with its own authored path", async () => {
  const childPath = "blueprints/child.yml";
  const original = {
    ...old,
    machine: {
      ...old.machine,
      states: { ...old.machine.states, waiting: { invoke: { id: "child", src: childPath } } },
    },
    schemas: { ...old.schemas, actors: { [childPath]: { input: true, output: true } } },
  };
  const childOld = { ...old, machine: { ...old.machine, context: { depot: "south" } } };
  const document = {
    ...next(),
    machine: original.machine,
    schemas: { ...next().schemas, actors: original.schemas.actors },
  };
  const f = await fixture(document, {
    original,
    oldFiles: { [childPath]: stringify(childOld) },
    newFiles: { [childPath]: stringify(next()) },
  });
  const before = f.store.loadSnapshot("parcel")!.snapshot;
  expect(await f.migrations.run()).toMatchObject({ migrated: ["parcel"] });
  expect(f.store.loadSnapshot("parcel")!.snapshot).toMatchObject({
    context: { zone: "north" },
    children: { child: { snapshot: { context: { zone: "south" } } } },
    entries: before["entries"],
  });
});
test("a missing child version refuses the parent before saving", async () => {
  const childPath = "blueprints/child.yml";
  const original = {
    ...old,
    machine: {
      ...old.machine,
      states: { ...old.machine.states, waiting: { invoke: { id: "child", src: childPath } } },
    },
    schemas: { ...old.schemas, actors: { [childPath]: { input: true, output: true } } },
  };
  const f = await fixture(
    {
      ...next(),
      machine: original.machine,
      schemas: { ...next().schemas, actors: original.schemas.actors },
    },
    { original, oldFiles: { [childPath]: stringify(old) } },
  );
  const before = f.store.loadSnapshot("parcel");
  expect(await f.migrations.run()).toMatchObject({ failed: [{ kind: "version-invalid" }] });
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
});
test("a held token in the target trap set refuses migration", async () => {
  const machine = {
    ...old.machine,
    initial: "queued",
    states: {
      ...old.machine.states,
      queued: {
        meta: { gate: { comparator: "comparators/order.ts", return: { state: "returned" } } },
        on: { "token.granted": "waiting" },
      },
      returned: { on: { scanned: "delivered" } },
    },
  };
  const f = await fixture(
    { ...next(), machine },
    { heldTokens: () => [{ gate: `${path}#queued`, tokenId: "token-one" }] },
  );
  expect(f.latest.failures.size).toBe(0);
  const before = f.store.loadSnapshot("parcel");
  expect(await f.migrations.run()).toMatchObject({ failed: [{ kind: "token-trap" }] });
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
});
test("drops undeclared deadlines and arms new numeric delays without renumbering entries", async () => {
  const machine = {
    ...old.machine,
    states: {
      ...old.machine.states,
      waiting: { ...old.machine.states.waiting, after: { 200000: "delivered" } },
    },
  };
  const f = await fixture({ ...next(), machine });
  const before = f.store.loadSnapshot("parcel")!.snapshot["entries"];
  const at = Date.now();
  await f.migrations.run();
  const deadlines = f.store.connection.database
    .prepare("SELECT * FROM store_deadline WHERE actor_id=?")
    .all("parcel");
  expect(deadlines).toHaveLength(1);
  expect(String(deadlines[0]!["event_name"])).toContain("#200000#");
  expect(Number(deadlines[0]!["fire_at"])).toBeGreaterThanOrEqual(at + 200000);
  expect((f.store.loadSnapshot("parcel")!.snapshot["entries"] as { count: number }).count).toBe(
    (before as { count: number }).count,
  );
});

test("two failures share a real escalation, and retry targets the current later revision", async () => {
  const document = next();
  document.migrations[0]!.context.params.expression =
    'context.depot = "north" ? $error("refused") : {"zone": context.depot}';
  const f = await fixture(document);
  await f.migrations.stop();
  const { openEscalations } = await import("../escalations/index.ts");
  let migrations!: ReturnType<typeof openMigrations>;
  const escalations = openEscalations({
    store: f.store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: { "migration-failed": (escalation) => migrations.migrationFailed(escalation) },
  });
  cleanup.push(() => escalations.stop());
  let latest = f.latest;
  migrations = openMigrations({
    store: f.store,
    actorHost: f.host,
    latest: () => latest,
    isAncestor: async (from, to) => from === a && to !== a,
    bundles: { recordedAt: () => undefined },
    escalations,
    log: () => {},
  });
  cleanup.push(() => migrations.stop());
  f.host.start({ actorId: "parcel-two", blueprint: f.first.blueprint, input: {} });
  await migrations.run();
  const questions = escalations.list({ status: "open" });
  expect(questions).toHaveLength(1);
  expect(f.store.migrationFailures(`${b}:${path}`)).toHaveLength(2);
  const c = "c".repeat(40);
  f.revisions.set(c, memoryRevision(c, { [path]: stringify(next()) }));
  latest = await f.loader.loadRevision(f.revisions.get(c)!);
  escalations.start();
  expect(escalations.answer(questions[0]!.id, { choice: "retry" }, "api").status).toBe("answered");
  await expect.poll(() => f.store.loadSnapshot("parcel")!.machine).toBe(`${c}:${path}`);
  await expect.poll(() => f.store.loadSnapshot("parcel-two")!.machine).toBe(`${c}:${path}`);
  expect(escalations.list({ status: "open" })).toEqual([]);
});
test.each([
  [true, false],
  [false, false],
  [true, true],
])(
  "orders bundled versions by persisted recording time (later %s, invalid %s)",
  async (isLater, invalid) => {
    const store = openStore({ path: ":memory:" });
    cleanup.push(() => store.close());
    const oldBundle = { digest: "1".repeat(64), files: new Map([[path, stringify(old)]]) };
    const newBundle = {
      digest: "2".repeat(64),
      files: new Map([[path, invalid ? "invalid" : stringify(next())]]),
    };
    const bundles = {
      current: newBundle,
      at: (digest: string) =>
        digest === oldBundle.digest
          ? oldBundle
          : digest === newBundle.digest
            ? newBundle
            : undefined,
      recordedAt: (digest: string) =>
        digest === oldBundle.digest
          ? 20
          : digest === newBundle.digest
            ? isLater
              ? 30
              : 10
            : undefined,
    };
    const revision = memoryRevision(a, {});
    const loader = createBlueprintLoader({
      bundles,
      implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
      revisionAt: async () => revision,
      onExpressionError: () => {},
      onStateEntry: recordStateEntry,
    });
    const first = await loader.version({ commit: a, path, bundle: oldBundle.digest });
    if (first.status !== "loaded") throw new Error("fixture version invalid");
    store.saveSnapshot({
      actorId: "other",
      machine: first.blueprint.key,
      snapshot: { status: "done", value: "delivered" },
    });
    const host = await openActorHost({ store, blueprints: loader, saveHooks: [], log: () => {} });
    const router = startRouter({ store, host });
    cleanup.push(() => router.stop());
    host.start({ actorId: "parcel", blueprint: first.blueprint, input: {} });
    const latest = await loader.loadRevision(revision);
    const migrations = openMigrations({
      store,
      actorHost: host,
      latest: () => latest,
      isAncestor: async () => false,
      bundles,
      escalations: {
        list: () => [],
        raise: () => {
          throw new Error("invalid bundle must only log");
        },
        withdraw: () => {},
      },
      log: () => {},
    });
    cleanup.push(() => migrations.stop());
    const before = store.loadSnapshot("parcel");
    const result = await migrations.run();
    if (!isLater) {
      expect(result).toEqual({ migrated: [], deferred: [], failed: [] });
      expect(store.loadSnapshot("parcel")).toEqual(before);
    } else if (invalid) {
      expect(result).toMatchObject({
        failed: [{ kind: "version-invalid", to: `${a}:${path}@${newBundle.digest}` }],
      });
      expect(store.loadSnapshot("parcel")).toEqual(before);
    } else {
      expect(result.migrated).toEqual(["parcel"]);
      expect(store.loadSnapshot("parcel")!.machine).toBe(`${a}:${path}@${newBundle.digest}`);
    }
  },
);
test("answers current and ended without saving, and rejects a target at another path", async () => {
  const f = await fixture();
  expect(await f.host.migrate("absent", f.latest.blueprints.get(path)!)).toEqual({
    status: "ended",
  });
  await expect(
    f.host.migrate("parcel", {
      ...f.latest.blueprints.get(path)!,
      version: { commit: b, path: "blueprints/other.yml" },
    }),
  ).rejects.toThrow(TypeError);
  await f.migrations.run();
  const before = f.store.loadSnapshot("parcel");
  expect(await f.host.migrate("parcel", f.latest.blueprints.get(path)!)).toEqual({
    status: "current",
  });
  expect(f.store.loadSnapshot("parcel")).toEqual(before);
});

async function realEscalations(f: Awaited<ReturnType<typeof fixture>>) {
  await f.migrations.stop();
  const { openEscalations } = await import("../escalations/index.ts");
  const escalations = openEscalations({
    store: f.store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {},
  });
  cleanup.push(() => escalations.stop());
  let latest = f.latest;
  const migrations = openMigrations({
    store: f.store,
    actorHost: f.host,
    latest: () => latest,
    isAncestor: async (from, to) => from === a && to !== a,
    bundles: { recordedAt: () => undefined },
    escalations,
    log: () => {},
  });
  cleanup.push(() => migrations.stop());
  return {
    escalations,
    migrations,
    select: (value: typeof latest) => {
      latest = value;
    },
  };
}
const refused = () => {
  const document = next();
  document.migrations[0]!.context.params.expression =
    'context.depot = "north" ? $error("refused") : {"zone": context.depot}';
  return document;
};
test.each(["completed", "later"])(
  "retires a failure and its escalation when the actor is %s",
  async (mode) => {
    const f = await fixture(refused());
    const r = await realEscalations(f);
    await r.migrations.run();
    expect(r.escalations.list({ status: "open" })).toHaveLength(1);
    if (mode === "completed") {
      f.router.publish({
        source: "github",
        eventId: "scan-failed",
        topics: ["github.issue.parcel-node"],
        event: { type: "scanned" },
      });
      await settle();
      expect(f.store.loadSnapshot("parcel")!.snapshot.status).toBe("done");
    } else {
      const c = "c".repeat(40);
      f.revisions.set(c, memoryRevision(c, { [path]: stringify(next()) }));
      r.select(await f.loader.loadRevision(f.revisions.get(c)!));
      await r.migrations.run();
      expect(f.store.loadSnapshot("parcel")!.machine).toBe(`${c}:${path}`);
    }
    expect(f.store.migrationFailure("parcel")).toBeUndefined();
    expect(r.escalations.list({ status: "open" })).toEqual([]);
  },
);
test("replacing failures retires the old target question only after its last actor leaves", async () => {
  const original = {
    ...old,
    schemas: { ...old.schemas, events: { ...old.schemas.events, checked: true } },
    machine: {
      ...old.machine,
      states: {
        ...old.machine.states,
        waiting: {
          ...old.machine.states.waiting,
          on: { ...old.machine.states.waiting.on, checked: {} },
        },
      },
    },
  };
  const f = await fixture(refused(), { original });
  f.host.start({
    actorId: "parcel-two",
    blueprint: f.first.blueprint,
    input: { manifold: { issue: "parcel-two-node" } },
  });
  const r = await realEscalations(f);
  await r.migrations.run();
  expect(r.escalations.list({ status: "open" })).toHaveLength(1);
  const question = r.escalations.list({ status: "open" })[0]!;
  const c = "c".repeat(40);
  f.revisions.set(c, memoryRevision(c, { [path]: stringify(refused()) }));
  r.select(await f.loader.loadRevision(f.revisions.get(c)!));
  f.router.publish({
    source: "github",
    eventId: "checked-two",
    topics: ["github.issue.parcel-two-node"],
    event: { type: "checked" },
  });
  await settle();
  await settle();
  expect(f.store.migrationFailure("parcel-two")!.to).toBe(`${c}:${path}`);
  expect(r.escalations.get(question.id)!.status).toBe("open");
  expect(r.escalations.list({ status: "open" })).toHaveLength(2);
  f.router.publish({
    source: "github",
    eventId: "checked-one",
    topics: ["github.issue.parcel-node"],
    event: { type: "checked" },
  });
  await settle();
  await settle();
  expect(f.store.migrationFailure("parcel")!.to).toBe(`${c}:${path}`);
  expect(r.escalations.get(question.id)!.status).toBe("withdrawn");
  expect(r.escalations.list({ status: "open" })).toMatchObject([
    { raiser: { subject: { version: `${c}:${path}` } } },
  ]);
});

test("a new migration run retires the durable question left after its failure row was cleared", async () => {
  const f = await fixture(refused());
  const r = await realEscalations(f);
  await r.migrations.run();
  await r.migrations.stop();
  const previous = f.store.loadSnapshot("parcel")!;
  f.store.saveSnapshot({
    actorId: "parcel",
    machine: previous.machine,
    snapshot: { ...previous.snapshot, status: "done", value: "delivered" },
  });
  expect(r.escalations.list({ status: "open" })).toHaveLength(1);
  const reopened = openMigrations({
    store: f.store,
    actorHost: f.host,
    latest: () => f.latest,
    isAncestor: async () => true,
    bundles: { recordedAt: () => undefined },
    escalations: r.escalations,
    log: () => {},
  });
  cleanup.push(() => reopened.stop());
  await reopened.run();
  expect(r.escalations.list({ status: "open" })).toEqual([]);
});
