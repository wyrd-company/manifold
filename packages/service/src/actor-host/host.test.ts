// ---
// relationships:
//   verifies: actor-host
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { assign, fromPromise } from "xstate";
import { stringify } from "yaml";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { createBlueprintLoader } from "../blueprint-loader/index.ts";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import { openStore } from "../store/index.ts";
import type { StoreOptions, Store } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { invocationOf, openActorHost, recordStateEntry } from "./index.ts";
import type { ActorSave, SaveHook, ActorHostOptions } from "./index.ts";

const commit = "a".repeat(40);
const directories: string[] = [];
const cleanups: (() => void)[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0).toReversed()) cleanup();
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
export const parcel = (states: Record<string, unknown>, context: Record<string, unknown> = {}) => ({
  machine: {
    id: "parcel",
    initial: "waiting",
    context,
    states: { ...states, delivered: { type: "final" } },
  },
  schemas: {
    input: { type: "object" },
    output: true,
    context: { type: "object" },
    events: { scanned: true, repeat: true } as Record<string, unknown>,
    actors: {},
  },
});
async function fixture(
  document = parcel({ waiting: { on: { scanned: "delivered" } } }),
  options: {
    implementations?: Partial<ImplementationRegistry>;
    hooks?: SaveHook[];
    log?: ActorHostOptions["log"];
    probe?: StoreOptions["probe"];
    files?: Record<string, string>;
  } = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "actor-host-"));
  directories.push(directory);
  const path = join(directory, "store.sqlite");
  let time = 100;
  const implementations = {
    actors: {},
    actions: {},
    guards: {},
    delays: {},
    ...options.implementations,
  };
  const revision = memoryRevision(commit, {
    "blueprints/parcel.yml": stringify(document),
    ...options.files,
  });
  const loader = createBlueprintLoader({
    implementations,
    revisionAt: async () => revision,
    onExpressionError: () => {},
    onStateEntry: recordStateEntry,
  });
  const result = await loader.version({ commit, path: "blueprints/parcel.yml" });
  if (result.status !== "loaded") throw new Error(JSON.stringify(result));
  let store = openStore({
    path,
    now: () => time,
    ...(options.probe ? { probe: options.probe } : {}),
  });
  for (let i = 0; i < 3; i++)
    store.saveSnapshot({
      actorId: `other-${i}`,
      machine: result.blueprint.key,
      snapshot: { status: "done", value: "delivered", context: {} },
    });
  let host = await openActorHost({
    store,
    blueprints: loader,
    saveHooks: options.hooks ?? [],
    log: options.log ?? (() => {}),
    now: () => time,
  });
  const clock = { now: () => time, setTimer: () => () => {} };
  let router = startRouter({ store, host, clock });
  cleanups.push(() => {
    router.stop();
    store.close();
  });
  const start = (
    input = { manifold: { issue: "parcel-node", environment: "station", threads: ["delivery.1"] } },
  ) => host.start({ actorId: "parcel", blueprint: result.blueprint, input });
  return {
    start,
    get host() {
      return host;
    },
    get router() {
      return router;
    },
    get store() {
      return store;
    },
    blueprint: result.blueprint,
    advance(at: number) {
      time = at;
    },
    async restart() {
      router.stop();
      store.close();
      store = openStore({ path, now: () => time });
      host = await openActorHost({
        store,
        blueprints: loader,
        saveHooks: options.hooks ?? [],
        log: options.log ?? (() => {}),
        now: () => time,
      });
      router = startRouter({ store, host, clock });
    },
    async send(type: string, eventId = type) {
      router.publish({
        source: "github",
        eventId,
        topics: ["github.issue.parcel-node"],
        event: { type },
      });
      await idle();
    },
    async fire() {
      for (const deadline of store.dueDeadlines(time))
        store.fireDeadline(deadline, `deadline.${deadline.deadlineId}`);
      await this.restart();
      await idle();
    },
    snapshot() {
      return store.loadSnapshot("parcel")!.snapshot;
    },
  };
}
const idle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("start validates both schemas, initializes identity before actions, and converges", async () => {
  let identity: unknown;
  let observed = 0;
  const f = await fixture(parcel({ waiting: { entry: "observe" } }), {
    implementations: {
      actions: {
        observe: ({ context }: { context: Record<string, unknown> }) => {
          identity = context["manifold"];
          observed++;
        },
      },
    },
  });
  expect(() =>
    f.host.start({
      actorId: "invalid",
      blueprint: f.blueprint,
      input: { manifold: { issue: 3 } as never },
    }),
  ).toThrow(/invalid/);
  expect(f.store.loadSnapshot("invalid")).toBeUndefined();
  f.start();
  f.start();
  expect(observed).toBe(1);
  expect(identity).toEqual({
    issue: "parcel-node",
    environment: "station",
    threads: ["delivery.1"],
  });
  expect(f.host.actorOf("parcel")).toEqual({ manifold: identity, commit });
  expect(f.host.subscription(f.store.loadSnapshot("parcel")!)).toEqual({
    topics: [
      "agent.environment.station.thread.delivery%2E1",
      "environment.station",
      "github.issue.parcel-node",
      "t3.environment.station.thread.delivery%2E1",
    ],
    events: ["scanned", "repeat"],
  });
  expect(f.snapshot()["entries"]).toMatchObject({ count: 2 });
});

test("delays survive restart, keep the first fire time, and fire once", async () => {
  const f = await fixture(parcel({ waiting: { after: { 50: "delivered" } } }));
  f.start();
  expect(f.store.dueDeadlines(150).filter((d) => d.actorId === "parcel")).toMatchObject([
    { fireAt: 150, entryId: "2" },
  ]);
  f.advance(120);
  f.router.persist("parcel");
  await f.restart();
  expect(f.store.dueDeadlines(150).filter((d) => d.actorId === "parcel")).toMatchObject([
    { fireAt: 150, entryId: "2" },
  ]);
  f.advance(150);
  await f.fire();
  expect(f.snapshot()).toMatchObject({ status: "done", value: "delivered" });
  expect(f.store.pendingInbox("parcel")).toEqual([]);
});

test("an old fired deadline cannot take a later entry's transition", async () => {
  const f = await fixture(
    parcel({
      waiting: { after: { 50: "delivered" }, on: { repeat: { target: "waiting", reenter: true } } },
    }),
  );
  f.start();
  f.store.writeInbox(
    { eventId: "repeat", topic: "github.issue.parcel-node", payload: { type: "repeat" } },
    ["parcel"],
  );
  f.advance(150);
  await f.fire();
  expect(f.snapshot()).toMatchObject({ status: "active", value: "waiting" });
  expect(f.store.dueDeadlines(200).filter((d) => d.actorId === "parcel")).toMatchObject([
    { fireAt: 200, entryId: "3" },
  ]);
  f.advance(200);
  await f.fire();
  expect(f.snapshot().status).toBe("done");
});

test("named delays use context after entry assignments", async () => {
  const f = await fixture(
    parcel({ waiting: { entry: "set-wait", after: { pause: "delivered" } } }, { wait: 10 }),
    {
      implementations: {
        actions: { "set-wait": assign({ wait: 200 }) },
        delays: {
          pause: ({ context }: { context: Record<string, unknown> }) => Number(context["wait"]),
        },
      },
    },
  );
  f.start();
  expect(f.store.dueDeadlines(300).filter((d) => d.actorId === "parcel")).toMatchObject([
    { fireAt: 300 },
  ]);
});

test("invocation identities survive restart, change on reentry, and promise results save", async () => {
  const identities: unknown[] = [];
  let resolve: ((value: unknown) => void) | undefined;
  const f = await fixture(
    parcel({
      waiting: {
        invoke: { id: "courier", src: "courier", onDone: "delivered" },
        on: { repeat: { target: "waiting", reenter: true } },
      },
    }),
    {
      implementations: {
        actors: {
          courier: fromPromise((args) => {
            identities.push(invocationOf(args));
            return new Promise((done) => {
              resolve = done;
            });
          }),
        },
      },
    },
  );
  f.start();
  await f.restart();
  expect(identities).toEqual([
    { actorId: "parcel", invokeId: "courier", entryId: "2" },
    { actorId: "parcel", invokeId: "courier", entryId: "2" },
  ]);
  await f.send("repeat");
  expect(identities.at(-1)).toEqual({ actorId: "parcel", invokeId: "courier", entryId: "3" });
  resolve!({});
  await idle();
  expect(f.snapshot().status).toBe("done");
});

test("save hooks see transient entries and retry them after a transaction rolls back", async () => {
  const saves: ActorSave[] = [];
  let hookStore: Store;
  let fail = false;
  const f = await fixture(
    parcel({
      waiting: { on: { scanned: "sorting" } },
      sorting: { always: "ready" },
      ready: { on: { repeat: { target: "ready", reenter: true } } },
    }),
    {
      hooks: [
        (save) => {
          saves.push(save);
          for (const path of save.entered)
            hookStore.connection.database.prepare("INSERT INTO test_hook VALUES (?)").run(path);
        },
      ],
      probe: (step) => {
        if (step === "saved" && fail) throw new Error("rollback");
      },
    },
  );
  hookStore = f.store;
  hookStore.connection.database.exec("CREATE TABLE test_hook (path TEXT) STRICT");
  f.start();
  const row = f.store.writeInbox(
    { eventId: "scan", topic: "github.issue.parcel-node", payload: { type: "scanned" } },
    ["parcel"],
  )[0]!;
  const restored = f.host.restore(f.store.loadSnapshot("parcel")!, f.router);
  if (restored.status !== "restored") throw new Error(restored.reason);
  fail = true;
  expect(() =>
    f.store.deliver({ ...restored.target, saved: (write) => f.host.saving!(write) }, row),
  ).toThrow("rollback");
  expect(saves.at(-1)?.entered).toEqual(["sorting", "ready"]);
  expect(
    hookStore.connection.database.prepare("SELECT * FROM test_hook WHERE path = 'sorting'").all(),
  ).toEqual([]);
  fail = false;
  f.router.attach(restored.target);
  expect(saves.at(-1)?.entered).toEqual(["sorting", "ready"]);
  const readyId = saves.at(-1)!.entries["ready"];
  expect(readyId).toEqual(expect.any(String));
  f.router.persist("parcel");
  expect(saves.at(-1)?.entries).toEqual({ ready: readyId });
  expect(saves.at(-1)?.entered).toEqual([]);
  await f.send("repeat");
  expect(saves.at(-1)?.entries).toEqual({ ready: expect.any(String) });
  expect(saves.at(-1)?.entries["ready"]).not.toBe(readyId);
  expect(
    hookStore.connection.database.prepare("SELECT * FROM test_hook WHERE path = 'sorting'").all(),
  ).toEqual([{ path: "sorting" }]);
});

test("child delays route to the child and output reaches the parent", async () => {
  const child = parcel({ waiting: { after: { 70: "delivered" } } });
  const f = await fixture(
    parcel({
      waiting: {
        invoke: { id: "nested.delivery", src: "blueprints/child.yml", onDone: "delivered" },
      },
    }),
    { files: { "blueprints/child.yml": stringify(child) } },
  );
  f.start();
  expect(f.snapshot()["entries"]).toMatchObject({ count: 4 });
  expect(f.store.dueDeadlines(170).filter((d) => d.actorId === "parcel")).toMatchObject([
    { statePath: "waiting", fireAt: 170, entryId: "4" },
  ]);
  await f.restart();
  f.advance(170);
  await f.fire();
  expect(f.snapshot().status).toBe("done");
});

test("invalid child blueprints fail the invoke into onError", async () => {
  const f = await fixture(
    parcel({
      waiting: { invoke: { id: "delivery", src: "blueprints/child.yml", onError: "delivered" } },
    }),
    { files: { "blueprints/child.yml": "machine: wrong" } },
  );
  f.start();
  await idle();
  expect(f.snapshot().status).toBe("done");
});

test("callbacks save identity changes and the router follows the new thread topic", async () => {
  const { fromCallback } = await import("xstate");
  let send: ((event: { type: string }) => void) | undefined;
  const hooks: ActorSave[] = [];
  const f = await fixture(
    parcel({
      waiting: {
        invoke: { id: "watch", src: "watch" },
        on: { scanned: { actions: "follow" }, repeat: "delivered" },
      },
    }),
    {
      hooks: [(save) => hooks.push(save)],
      implementations: {
        actors: {
          watch: fromCallback((args) => {
            expect(invocationOf(args).entryId).toBe("2");
            send = args.sendBack;
          }),
        },
        actions: {
          follow: assign({
            manifold: ({ context }) => ({ ...context["manifold"], threads: ["delivery.2"] }),
          }),
        },
      },
    },
  );
  f.start();
  expect(hooks[0]?.activeInvokes).toEqual([{ invokeId: "watch", entryId: "2" }]);
  send!({ type: "scanned" });
  await idle();
  expect(
    f.router.publish({
      source: "t3",
      eventId: "new-thread",
      topics: ["t3.environment.station.thread.delivery%2E2"],
      event: { type: "repeat" },
    }),
  ).toMatchObject({ rows: [{ actorId: "parcel" }] });
  await idle();
  expect(f.snapshot().status).toBe("done");
  expect(hooks.at(-1)?.activeInvokes).toEqual([]);
});

test("missing and incompatible versions hold without creating an actor", async () => {
  const f = await fixture();
  const snapshot = {
    status: "active" as const,
    value: "absent",
    context: { manifold: { issue: "parcel-node" } },
  };
  expect(
    f.host.restore({ actorId: "missing", machine: "bad-key", snapshot, savedAt: 0 }, f.router),
  ).toMatchObject({ status: "held", reason: expect.stringContaining("missing (file)") });
  f.start();
  expect(
    f.host.restore(
      { actorId: "incompatible", machine: f.blueprint.key, snapshot, savedAt: 0 },
      f.router,
    ),
  ).toEqual({ status: "held", reason: "state-missing: absent" });
});

test("hooks run in order, roll back writes on failure, and ignore errored saves", async () => {
  const order: number[] = [];
  let fail = false;
  const f = await fixture(parcel({ waiting: { on: { scanned: { actions: "explode" } } } }), {
    hooks: [
      () => {
        order.push(1);
      },
      () => {
        order.push(2);
        if (fail) throw new Error("hook rollback");
      },
    ],
    implementations: {
      actions: {
        explode: () => {
          throw new Error("failed action");
        },
      },
    },
  });
  f.start();
  expect(order).toEqual([1, 2]);
  const before = f.snapshot();
  fail = true;
  expect(() => f.router.persist("parcel")).toThrow("hook rollback");
  expect(f.snapshot()).toEqual(before);
  fail = false;
  order.length = 0;
  await f.send("scanned");
  expect(order).toEqual([]);
  expect(f.snapshot()).toEqual(before);
  expect(f.store.loadErroredSnapshot("parcel")).toBeDefined();
  expect(f.host.followers("station", "delivery.1")).toEqual(["parcel"]);
});

test("the root delayed transition uses the empty state path", async () => {
  const document = parcel({ waiting: {} });
  const f = await fixture({
    ...document,
    machine: { ...document.machine, after: { 30: ".delivered" } },
  } as typeof document);
  f.start();
  expect(f.store.dueDeadlines(130).filter((d) => d.actorId === "parcel")).toMatchObject([
    { statePath: "", entryId: "1", fireAt: 130 },
  ]);
  f.advance(130);
  await f.fire();
  expect(f.snapshot().status).toBe("done");
});

test("invoked child expressions read an absent identity", async () => {
  let childIdentity: unknown = "unset";
  const child = parcel({ waiting: { entry: "observe-child", after: { 10: "delivered" } } });
  const f = await fixture(
    parcel({
      waiting: { invoke: { id: "child", src: "blueprints/child.yml", onDone: "delivered" } },
    }),
    {
      files: { "blueprints/child.yml": stringify(child) },
      implementations: {
        actions: {
          "observe-child": ({ context }: { context: Record<string, unknown> }) => {
            childIdentity = context["manifold"];
          },
        },
      },
    },
  );
  f.start();
  expect(childIdentity).toBeUndefined();
});

test("a child output mapping arrives in the parent's done event", async () => {
  let output: unknown;
  const child = {
    ...parcel({ waiting: { after: { 5: "delivered" } } }),
    machine: {
      id: "child",
      initial: "waiting",
      context: {},
      states: {
        waiting: { after: { 5: "delivered" } },
        delivered: { type: "final", output: { received: true } },
      },
    },
  };
  const f = await fixture(
    parcel({
      waiting: {
        invoke: {
          id: "child",
          src: "blueprints/child.yml",
          onDone: { target: "delivered", actions: "output" },
        },
      },
    }),
    {
      files: { "blueprints/child.yml": stringify(child) },
      implementations: {
        actions: {
          output: ({ event }: { event: { output: unknown } }) => {
            output = event.output;
          },
        },
      },
    },
  );
  f.start();
  f.advance(105);
  await f.fire();
  expect(output).toEqual({ received: true });
});

test("a start without identity defaults to an empty identity and validates own input", async () => {
  const document = parcel({ waiting: {} });
  document.schemas.input = {
    type: "object",
    required: ["label"],
    properties: { label: { type: "string" } },
    additionalProperties: false,
  } as typeof document.schemas.input;
  const f = await fixture(document);
  expect(() => f.host.start({ actorId: "invalid", blueprint: f.blueprint, input: {} })).toThrow(
    "label",
  );
  f.host.start({ actorId: "parcel", blueprint: f.blueprint, input: { label: "sample" } });
  expect(f.host.actorOf("parcel")?.manifold).toEqual({});
});

test("a failed initial save can retry start with the same invocation identity", async () => {
  let fail = true;
  const identities: unknown[] = [];
  const f = await fixture(parcel({ waiting: { invoke: { id: "courier", src: "courier" } } }), {
    hooks: [
      () => {
        if (fail) throw new Error("initial rollback");
      },
    ],
    implementations: {
      actors: {
        courier: fromPromise((args) => {
          identities.push(invocationOf(args));
          return new Promise(() => {});
        }),
      },
    },
  });
  expect(() => f.start()).toThrow("initial rollback");
  expect(f.store.loadSnapshot("parcel")).toBeUndefined();
  expect(f.host.followers("station", "delivery.1")).toEqual([]);
  expect(f.host.issueThreads("parcel-node")).toEqual([]);
  fail = false;
  f.start();
  expect(f.snapshot().status).toBe("active");
  expect(identities).toEqual([
    { actorId: "parcel", invokeId: "courier", entryId: "2" },
    { actorId: "parcel", invokeId: "courier", entryId: "2" },
  ]);
});

test("router stop aborts the host's active invokes", async () => {
  let aborted = false;
  const f = await fixture(parcel({ waiting: { invoke: { id: "courier", src: "courier" } } }), {
    implementations: {
      actors: {
        courier: fromPromise(({ signal }) => {
          signal.addEventListener("abort", () => {
            aborted = true;
          });
          return new Promise(() => {});
        }),
      },
    },
  });
  f.start();
  f.router.stop();
  expect(aborted).toBe(true);
});

test("the same invoke id in successive states uses the active state's entry", async () => {
  const identities: unknown[] = [];
  const f = await fixture(
    parcel({
      waiting: { invoke: { id: "courier", src: "courier" }, on: { scanned: "sorting" } },
      sorting: { invoke: { id: "courier", src: "courier" } },
    }),
    {
      implementations: {
        actors: {
          courier: fromPromise((args) => {
            identities.push(invocationOf(args));
            return new Promise(() => {});
          }),
        },
      },
    },
  );
  f.start();
  await f.send("scanned");
  expect(identities).toEqual([
    { actorId: "parcel", invokeId: "courier", entryId: "2" },
    { actorId: "parcel", invokeId: "courier", entryId: "3" },
  ]);
});

test("opening preloads versions and release reloads before calling the router", async () => {
  const f = await fixture();
  f.start();
  const calls: string[] = [];
  let available = false;
  const host = await openActorHost({
    store: f.store,
    blueprints: {
      async version(version) {
        calls.push(version.path);
        return available
          ? { status: "loaded", blueprint: f.blueprint }
          : { status: "missing", reason: "file" };
      },
    },
    saveHooks: [],
    log: () => {},
  });
  const stored = f.store.loadSnapshot("parcel")!;
  expect(host.restore(stored, f.router)).toMatchObject({
    status: "held",
    reason: expect.stringContaining("missing (file)"),
  });
  expect(host.subscription(stored)).not.toHaveProperty("events");
  available = true;
  host.connect!({
    ...f.router,
    release(actorId: string) {
      expect(actorId).toBe("parcel");
      expect(host.restore(stored, f.router).status).toBe("restored");
    },
  } as typeof f.router);
  await host.release("parcel");
  expect(calls).toEqual(["blueprints/parcel.yml", "blueprints/parcel.yml"]);
});

test("invalid versions hold with the first lint finding and loader rejections propagate", async () => {
  const f = await fixture();
  f.start();
  const host = await openActorHost({
    store: f.store,
    blueprints: {
      version: async () => ({
        status: "invalid",
        findings: [
          { path: "blueprints/parcel.yml", kind: "shape", location: "/machine", message: "bad" },
        ],
      }),
    },
    saveHooks: [],
    log: () => {},
  });
  expect(host.restore(f.store.loadSnapshot("parcel")!, f.router)).toMatchObject({
    status: "held",
    reason: expect.stringContaining("invalid: shape at /machine"),
  });
  await expect(
    openActorHost({
      store: f.store,
      blueprints: {
        version: async () => {
          throw new Error("repository read failed");
        },
      },
      saveHooks: [],
      log: () => {},
    }),
  ).rejects.toThrow("repository read failed");
});

test("start and release require the router connection", async () => {
  const f = await fixture();
  const host = await openActorHost({
    store: f.store,
    blueprints: { version: async () => ({ status: "loaded", blueprint: f.blueprint }) },
    saveHooks: [],
    log: () => {},
  });
  expect(() => host.start({ actorId: "parcel", blueprint: f.blueprint, input: {} })).toThrow(
    "not connected",
  );
  await expect(host.release("parcel")).rejects.toThrow("not connected");
});

test.each(["hook error", "hook TypeError", "store error"])(
  "queued saves propagate the original %s after logging and rollback",
  async (kind) => {
    const failure = kind === "hook TypeError" ? new TypeError("hook failure") : new Error(kind);
    let fail = false;
    let finish!: () => void;
    const log = vi.fn();
    const f = await fixture(
      parcel({ waiting: { invoke: { src: "deliver", onDone: "ready" } }, ready: {} }),
      {
        implementations: {
          actors: {
            deliver: fromPromise(
              () =>
                new Promise<void>((resolve) => {
                  finish = resolve;
                }),
            ),
          },
        },
        hooks: [
          () => {
            if (fail && kind.startsWith("hook")) throw failure;
          },
        ],
        log,
      },
    );
    f.start();
    if (kind === "store error") {
      const save = f.store.saveSnapshot.bind(f.store);
      vi.spyOn(f.store, "saveSnapshot").mockImplementation((write) => {
        const result = save(write);
        if (fail) throw failure;
        return result;
      });
    }
    const queued: (() => void)[] = [];
    vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => queued.push(callback));
    fail = true;
    finish();
    await idle();
    expect(queued).toHaveLength(1);
    let caught: unknown;
    try {
      queued.shift()!();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(failure);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ event: "actor-save", message: failure.message }),
    );
    expect(f.snapshot().value).toBe("waiting");
    fail = false;
    f.router.persist("parcel");
    expect(f.snapshot().value).toBe("ready");
  },
);

test("a queued save of a removed actor does nothing without logging", async () => {
  let finish!: () => void;
  const log = vi.fn();
  const f = await fixture(
    parcel({ waiting: { invoke: { src: "deliver", onDone: "delivered" } } }),
    {
      implementations: {
        actors: {
          deliver: fromPromise(
            () =>
              new Promise<void>((resolve) => {
                finish = resolve;
              }),
          ),
        },
      },
      log,
    },
  );
  f.start();
  const queued: (() => void)[] = [];
  vi.spyOn(globalThis, "queueMicrotask").mockImplementation((callback) => queued.push(callback));
  finish();
  await idle();
  expect(queued).toHaveLength(1);
  f.router.persist("parcel");
  expect(() => f.router.persist("parcel")).toThrow(TypeError);
  expect(() => queued.shift()!()).not.toThrow();
  expect(log).not.toHaveBeenCalled();
});

test("thread followers and event schemas include held snapshots and agent topics", async () => {
  const f = await fixture();
  f.start();
  expect(f.host.followers("station", "delivery.1")).toEqual(["parcel"]);
  expect(f.host.followedThreads("station")).toEqual(["delivery.1"]);
  expect(
    f.host.subscription({ actorId: "parcel", machine: f.blueprint.key, snapshot: f.snapshot() })
      .topics,
  ).toContain("agent.environment.station.thread.delivery%2E1");
  expect(f.host.eventSchema("parcel", "scanned").status).toBe("declared");
  expect(f.host.eventSchema("parcel", "absent")).toEqual({ status: "undeclared" });
  f.store.saveSnapshot({
    actorId: "held",
    machine: "missing",
    snapshot: {
      status: "active",
      value: "waiting",
      context: { manifold: { environment: "station", threads: ["delivery.1", "second"] } },
    },
  });
  await f.restart();
  expect(f.host.followers("station", "delivery.1")).toEqual(["held", "parcel"]);
  expect(f.host.followedThreads("station")).toEqual(["delivery.1", "second"]);
  expect(f.host.eventSchema("held", "scanned")).toEqual({ status: "unavailable" });
  await f.send("scanned");
  expect(f.host.followers("station", "delivery.1")).toEqual(["held"]);
});

test("event schema reads resolve the same bundled references as blueprint lint", async () => {
  const document = parcel({ waiting: { on: { scanned: "delivered" } } });
  document.schemas.events["scanned"] = {
    $ref: "https://manifold.wyrd.company/schemas/agent-tools#/$defs/agent-handoff-event",
  };
  const f = await fixture(document);
  f.start();
  const schema = f.host.eventSchema("parcel", "scanned");
  expect(schema.status).toBe("declared");
  if (schema.status !== "declared") throw new Error("Missing event schema");
  expect(
    schema.validate({
      type: "agent.handoff",
      environment: "station",
      threadId: "conversation",
      turnId: "turn",
      handoff: null,
    }),
  ).toBe(true);
  expect(schema.validate({ type: "agent.handoff" })).toBe(false);
});

test("identity reads use saved indexes through attach, changes, hold, restore and completion", async () => {
  const f = await fixture(
    parcel({ waiting: { on: { repeat: { actions: "follow" }, scanned: "delivered" } } }),
    {
      implementations: {
        actions: {
          follow: assign({
            manifold: () => ({ issue: "changed", environment: "elsewhere", threads: ["second"] }),
          }),
        },
      },
    },
  );
  const assertReads = (host: typeof f.host, issue: string, environment: string, thread: string) => {
    const scanning = vi.spyOn(f.store, "activeSnapshots").mockImplementation(() => {
      throw Error("read scanned snapshots");
    });
    try {
      expect(host.followers(environment, thread)).toEqual(["parcel"]);
      expect(host.followedThreads(environment)).toEqual([thread]);
      expect(host.issueThreads(issue)).toEqual([
        { actorId: "parcel", environment, threadId: thread },
      ]);
    } finally {
      scanning.mockRestore();
    }
  };
  f.start();
  assertReads(f.host, "parcel-node", "station", "delivery.1");
  await f.send("repeat");
  expect(f.host.followers("station", "delivery.1")).toEqual([]);
  expect(f.host.issueThreads("parcel-node")).toEqual([]);
  assertReads(f.host, "changed", "elsewhere", "second");
  await f.restart();
  assertReads(f.host, "changed", "elsewhere", "second");
  const held = await openActorHost({
    store: f.store,
    blueprints: { version: async () => ({ status: "missing", reason: "file" }) },
    saveHooks: [],
    log: () => {},
  });
  expect(held.restore(f.store.loadSnapshot("parcel")!, f.router).status).toBe("held");
  assertReads(held, "changed", "elsewhere", "second");
  f.router.publish({
    source: "github",
    eventId: "end",
    topics: ["github.issue.changed"],
    event: { type: "scanned" },
  });
  await idle();
  expect(f.host.followers("elsewhere", "second")).toEqual([]);
  expect(f.host.followedThreads("elsewhere")).toEqual([]);
  expect(f.host.issueThreads("changed")).toEqual([]);
});

test("event validators are shared per version and type and available before the first save", async () => {
  let initial: ReturnType<typeof f.host.eventSchema> | undefined;
  const f = await fixture(parcel({ waiting: { entry: "look" } }), {
    implementations: {
      actions: {
        look: () => {
          initial = f.host.eventSchema("parcel", "scanned");
        },
      },
    },
  });
  f.start();
  const first = f.host.eventSchema("parcel", "scanned");
  expect(initial?.status).toBe("declared");
  if (first.status !== "declared" || initial?.status !== "declared")
    throw Error("Missing validator");
  expect(initial.validate).toBe(first.validate);
  const second = f.host.eventSchema("parcel", "scanned");
  if (second.status !== "declared") throw Error("Missing validator");
  expect(second.validate).toBe(first.validate);
  f.host.start({ actorId: "another", blueprint: f.blueprint, input: {} });
  const shared = f.host.eventSchema("another", "scanned");
  if (shared.status !== "declared") throw Error("Missing validator");
  expect(shared.validate).toBe(first.validate);
  const other = f.host.eventSchema("parcel", "repeat");
  if (other.status !== "declared") throw Error("Missing validator");
  expect(other.validate).not.toBe(first.validate);
});

test("keeps the last state-changing event through an ignored callback and routed delivery", async () => {
  let send!: (event: { type: string }) => void;
  const saves: ActorSave[] = [];
  const { fromCallback } = await import("xstate");
  const document = parcel({
    waiting: { invoke: { id: "scanner", src: "scanner" }, on: { packed: "ready" } },
    ready: {},
  });
  document.schemas.events["packed"] = true;
  const f = await fixture(document, {
    implementations: {
      actors: {
        scanner: fromCallback(({ sendBack }) => {
          send = sendBack;
        }),
      },
    },
    hooks: [(save) => saves.push(save)],
  });
  f.start();
  send({ type: "packed" });
  send({ type: "ignored" });
  f.store.writeInbox(
    { eventId: "unrelated", topic: "github.issue.parcel-node", payload: { type: "repeat" } },
    ["parcel"],
  );
  f.router.schedule("parcel");
  // The queued callback save runs first; its changedBy must survive the next save too.
  await idle();
  expect(saves.at(-1)).toMatchObject({ changedBy: { type: "packed" }, eventId: "unrelated" });
  expect(saves.at(-1)!.changedBy).not.toHaveProperty("eventId");
});
test("names routed state changes and invoked results independently of the consumed row", async () => {
  const saves: ActorSave[] = [];
  const f = await fixture(
    parcel({
      waiting: { on: { scanned: "shipping" } },
      shipping: { invoke: { id: "ship", src: "ship", onDone: "delivered" } },
    }),
    {
      implementations: { actors: { ship: fromPromise(async () => ({ label: "large" })) } },
      hooks: [(save) => saves.push(save)],
    },
  );
  f.start();
  await f.send("scanned");
  await idle();
  expect(saves.find((save) => save.snapshot.value === "shipping")!.changedBy).toEqual({
    type: "scanned",
    eventId: "github:scanned",
  });
  expect(saves.at(-1)!.changedBy).toEqual({ type: "xstate.done.actor.ship" });
});

test("saves a callback change with no exit event id when the same save consumes an ignored row", async () => {
  const { openHistory } = await import("../history/index.ts");
  const { fromCallback } = await import("xstate");
  let send!: (event: { type: string }) => void;
  let history!: ReturnType<typeof openHistory>;
  const document = parcel({
    waiting: { invoke: { id: "scanner", src: "scanner" }, on: { packed: "ready" } },
    ready: {},
  });
  document.schemas.events["packed"] = true;
  const f = await fixture(document, {
    implementations: {
      actors: {
        scanner: fromCallback(({ sendBack }) => {
          send = sendBack;
        }),
      },
    },
    hooks: [(save) => history.saveHook(save)],
  });
  history = openHistory({ store: f.store, log: () => {} });
  f.start();
  const restored = f.host.restore(f.store.loadSnapshot("parcel")!, f.router);
  if (restored.status !== "restored") throw new Error("Fixture restore held");
  f.router.attach(restored.target);
  send({ type: "packed" });
  send({ type: "ignored" });
  const row = f.store.writeInbox(
    { eventId: "unrelated", topic: "github.issue.parcel-node", payload: { type: "repeat" } },
    ["parcel"],
  )[0]!;
  f.store.deliver({ ...restored.target, saved: (write) => f.host.saving!(write) }, row);
  expect(history.read("parcel")!.visits[0]!.exitEvent).toEqual({ type: "packed" });
  expect(history.read("parcel")!.events[0]).toMatchObject({
    eventId: "unrelated",
    visit: 1,
    consumedAt: expect.any(String),
  });
  await idle();
});

test("names a root deadline as the state change that its inbox delivery made", async () => {
  const saves: ActorSave[] = [];
  const f = await fixture(parcel({ waiting: { after: { 5: "delivered" } } }), {
    hooks: [(save) => saves.push(save)],
  });
  f.start();
  f.advance(110);
  await f.fire();
  expect(saves.at(-1)!.changedBy).toEqual({
    type: "xstate.after.5.parcel.waiting",
    eventId: "deadline:1",
  });
});
test("a routed re-entry keeps one history visit and links the event to that visit", async () => {
  const { openHistory } = await import("../history/index.ts");
  let history!: ReturnType<typeof openHistory>;
  const f = await fixture(
    parcel({ waiting: { on: { repeat: { target: "waiting", reenter: true } } } }),
    { hooks: [(save) => history.saveHook(save)] },
  );
  history = openHistory({ store: f.store, log: () => {} });
  f.start();
  await f.send("repeat");
  expect(history.read("parcel")!.visits).toHaveLength(1);
  expect(history.read("parcel")!.events[0]).toMatchObject({ eventId: "github:repeat", visit: 1 });
});

test("environment actions reach only actors on that environment, without a thread", async () => {
  const document = parcel({ waiting: { on: { "environment.paused": "delivered" } } });
  document.schemas.events = { "environment.paused": true };
  const f = await fixture(document);
  f.host.start({
    actorId: "parcel",
    blueprint: f.blueprint,
    input: { manifold: { environment: "station" } },
  });
  f.host.start({
    actorId: "other-parcel",
    blueprint: f.blueprint,
    input: { manifold: { environment: "depot" } },
  });
  const result = f.router.publish({
    source: "environment",
    eventId: "station/1",
    topics: ["environment.station"],
    event: { type: "environment.paused", environment: "station", at: "2026-01-01T00:00:00.000Z" },
  });
  expect(result.status).toBe("accepted");
  await expect.poll(() => f.store.loadSnapshot("parcel")?.snapshot.status).toBe("done");
  expect(f.store.loadSnapshot("other-parcel")?.snapshot.value).toBe("waiting");
});
