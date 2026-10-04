// ---
// relationships:
//   verifies: durable-event-delivery
//   references: router-events
// ---
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { openStore, type DeliveryTarget, type SnapshotWrite, type Store } from "../store/index.ts";
import {
  startRouter,
  type ActorHost,
  type Router,
  type RouterClock,
  type SourceEvent,
} from "./index.ts";

type Context = {
  topics: string[];
  seen: string[];
  status: "active" | "done" | "error";
  value: string;
  fireAt?: number;
};
let directory: string;
let path: string;
let store: Store;
let router: Router | undefined;
let time: number;
let timers: Map<number, { delay: number; wake: () => void }>;
let timerId: number;
let states: Map<string, Context>;
let duringSend: ((id: string, eventId: string) => void) | undefined;
let held: Set<string>;
let host: ActorHost;
let clock: RouterClock;
const idle = () => new Promise<void>((resolve) => setImmediate(resolve));
const event = (
  eventId = "reading",
  topics = ["weather.station.s1"],
  type = "reading",
): SourceEvent => ({ source: "weather", eventId, topics, event: { type, amount: 1 } });
function write(id: string, context: Context): SnapshotWrite {
  return {
    actorId: id,
    machine: "counter",
    snapshot:
      context.status === "error"
        ? { status: "error" }
        : { status: context.status, value: context.value, context },
    ...(context.fireAt === undefined
      ? {}
      : {
          deadlines: [
            { statePath: "idle", eventName: "tick", entryId: "entry-a", fireAt: context.fireAt },
          ],
        }),
  };
}
function target(id: string, context: Context): DeliveryTarget {
  states.set(id, context);
  return {
    actorId: id,
    send(row) {
      context.seen.push(row.eventId);
      duringSend?.(id, row.eventId);
    },
    persist() {
      const { actorId: _, ...result } = write(id, context);
      return result;
    },
  };
}
function context(topics = ["weather.station.s1"]): Context {
  return { topics, seen: [], status: "active", value: "idle" };
}
function seen(id = "counter-00") {
  return (store.loadSnapshot(id)!.snapshot["context"] as Context).seen;
}
function start(options: Partial<Parameters<typeof startRouter>[0]> = {}) {
  router = startRouter({ store, host, clock, ...options });
  return router;
}
function wake() {
  const first = timers.values().next().value!;
  timers.clear();
  first.wake();
}
function reopen() {
  router?.stop();
  store.close();
  store = openStore({ path, now: () => time });
}
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "router-test-"));
  path = join(directory, "data.sqlite");
  time = 10;
  timerId = 0;
  timers = new Map();
  states = new Map();
  held = new Set();
  duringSend = undefined;
  store = openStore({ path, now: () => time });
  clock = {
    now: () => time,
    setTimer(delay, wake) {
      const id = timerId++;
      timers.set(id, { delay, wake });
      return () => {
        timers.delete(id);
      };
    },
  };
  host = {
    subscription(record) {
      return {
        topics: (record.snapshot["context"] as Context).topics,
        events: ["reading", "tick"],
      };
    },
    restore(record) {
      return held.has(record.actorId)
        ? { status: "held", reason: "missing implementation" }
        : {
            status: "restored",
            target: target(record.actorId, structuredClone(record.snapshot["context"] as Context)),
          };
    },
  };
  for (let i = 0; i < 20; i++) {
    const id = `counter-${String(i).padStart(2, "0")}`;
    const data = context(
      i === 0
        ? ["weather.station.s1", "weather.region"]
        : i === 1
          ? ["weather.station"]
          : i === 2
            ? ["weather.station.s10"]
            : ["weather.other"],
    );
    if (i === 19) data.status = "done";
    data.value = i % 2 === 0 ? "idle" : "waiting";
    if (i % 2 === 0) data.fireAt = 100 + i;
    store.saveSnapshot(write(id, data));
    store.writeInbox({ eventId: `seed-${i}`, topic: "weather", payload: { type: "reading" } }, [
      id,
    ]);
    if (i % 2 === 0 || i === 19) store.markConsumed(id, `seed-${i}`);
  }
});
afterEach(() => {
  router?.stop();
  router = undefined;
  store.close();
  rmSync(directory, { recursive: true, force: true });
});

test("fan-out matches whole segments and event types, deduplicates topics and is asynchronous", async () => {
  const r = start();
  const outcome = r.publish(event("multi", ["weather.station.s1.child", "weather.region"]));
  expect(outcome.status).toBe("accepted");
  if (outcome.status !== "accepted") throw new Error("Expected acceptance");
  expect(outcome.replay).toBe(false);
  expect(outcome.rows.map((row) => [row.actorId, row.topic])).toEqual([
    ["counter-01", "weather.station.s1.child"],
    ["counter-00", "weather.station.s1.child"],
  ]);
  expect(seen()).toEqual([]);
  await idle();
  expect(seen()).toEqual(["weather:multi"]);
  expect(seen("counter-01")).toEqual(["seed-1", "weather:multi"]);
  expect(seen("counter-02")).toEqual([]);
  expect(r.publish(event("wrong-type", undefined, "other"))).toMatchObject({
    status: "accepted",
    rows: [],
  });
});

test("replay freezes first targets through attach, persist, targetless acceptance and reopening", async () => {
  const r = start();
  r.publish(event());
  await idle();
  r.attach(target("later", context()));
  states.get("counter-02")!.topics = ["weather.station.s1"];
  r.persist("counter-02");
  expect(r.publish(event())).toEqual({ status: "accepted", replay: true, rows: [] });
  expect(store.pendingInbox("later")).toEqual([]);
  expect(r.publish(event("empty", ["weather.absent"]))).toEqual({
    status: "accepted",
    replay: false,
    rows: [],
  });
  states.get("later")!.topics = ["weather.absent"];
  r.persist("later");
  expect(r.publish(event("empty", ["weather.absent"]))).toEqual({
    status: "accepted",
    replay: true,
    rows: [],
  });
  reopen();
  const resumed = start();
  expect(resumed.publish(event())).toEqual({ status: "accepted", replay: true, rows: [] });
  expect(seen()).toEqual(["weather:reading"]);
});

test("source acceptance and inbox fan-out join the caller transaction and roll back together", async () => {
  const r = start();
  expect(() =>
    store.connection.transaction(() => {
      r.publish(event());
      expect(seen()).toEqual([]);
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  await idle();
  expect(seen()).toEqual([]);
  expect(store.pendingInbox("counter-00")).toEqual([]);
  expect(r.publish(event())).toMatchObject({ status: "accepted", replay: false });
  await idle();
  expect(seen()).toEqual(["weather:reading"]);
});

test("failed fan-out rolls back source acceptance and all inbox writes", () => {
  const r = start();
  store.connection.database.exec(
    "CREATE TRIGGER reject_inbox BEFORE INSERT ON store_inbox WHEN NEW.actor_id = 'counter-00' BEGIN SELECT RAISE(ABORT, 'rejected'); END",
  );
  expect(() => r.publish(event())).toThrow();
  expect(store.pendingInbox("counter-00")).toEqual([]);
  store.connection.database.exec("DROP TRIGGER reject_inbox");
  expect(r.publish(event())).toMatchObject({ status: "accepted", replay: false });
});

test("resume drains to global quiescence before afterDrain and preserves insertion order", async () => {
  store.writeInbox({ eventId: "second", topic: "weather", payload: { type: "reading" } }, [
    "counter-01",
  ]);
  host.restore = (stored, r) => ({
    status: "restored",
    target: {
      ...target(stored.actorId, structuredClone(stored.snapshot["context"] as Context)),
      send(row) {
        states.get(stored.actorId)!.seen.push(row.eventId);
        if (stored.actorId === "counter-01" && row.eventId === "seed-1")
          r.publish(event("during-resume"));
      },
    },
  });
  let drained = false;
  const r = start({
    afterDrain() {
      drained = true;
      expect(seen()).toEqual(["weather:during-resume"]);
      expect(
        store.activeSnapshots().every((row) => store.pendingInbox(row.actorId).length === 0),
      ).toBe(true);
    },
  });
  expect(drained).toBe(true);
  r.publish(event("live"));
  await idle();
  expect(seen("counter-01")).toEqual(["seed-1", "second", "weather:during-resume", "weather:live"]);
});

test("nested publish and persist never re-enter a delivery and snapshot changes update subscriptions", async () => {
  const r = start();
  let inSend = false;
  duringSend = (id, eventId) => {
    expect(inSend).toBe(false);
    inSend = true;
    if (id === "counter-00" && eventId === "weather:first") {
      states.get(id)!.topics = ["weather.new"];
      r.persist(id);
      r.publish(event("second"));
    }
    inSend = false;
  };
  r.publish(event("first"));
  await idle();
  await idle();
  expect(seen()).toEqual(["weather:first", "weather:second"]);
  r.publish(event("new-topic", ["weather.new"]));
  await idle();
  expect(seen()).toEqual(["weather:first", "weather:second", "weather:new-topic"]);
  states.get("counter-00")!.status = "done";
  r.persist("counter-00");
  expect(r.publish(event("third", ["weather.new"]))).toMatchObject({ rows: [] });
});

test("held actors receive pending rows and restore after restart; errors hold only their actor", async () => {
  held.add("counter-00");
  const holds: unknown[] = [];
  const r = start({ onHeld: (value) => holds.push(value) });
  r.publish(event("held"));
  await idle();
  expect(store.pendingInbox("counter-00")).toHaveLength(1);
  expect(seen()).toEqual([]);
  expect(holds).toContainEqual({
    actorId: "counter-00",
    reason: "missing implementation",
    row: undefined,
  });
  states.get("counter-01")!.status = "error";
  r.publish(event("bad"));
  await idle();
  expect(holds).toHaveLength(2);
  expect(store.loadErroredSnapshot("counter-01")?.eventId).toBe("weather:bad");
  r.publish(event("later"));
  await idle();
  expect(holds).toHaveLength(2);
  reopen();
  held.clear();
  start();
  expect(seen()).toEqual(["weather:held", "weather:bad", "weather:later"]);
  expect(seen("counter-01")).toEqual(["seed-1", "weather:held", "weather:bad", "weather:later"]);
});

test("one deadline timer tracks the earliest row, persists earlier arms, fires downtime once and cancels exited states", async () => {
  const r = start();
  expect(timers.size).toBe(1);
  expect([...timers.values()][0]!.delay).toBe(90);
  states.get("counter-01")!.value = "idle";
  states.get("counter-01")!.fireAt = 20;
  r.persist("counter-01");
  expect(timers.size).toBe(1);
  expect([...timers.values()][0]!.delay).toBe(10);
  states.get("counter-00")!.value = "closed";
  delete states.get("counter-00")!.fireAt;
  r.persist("counter-00");
  reopen();
  time = 21;
  let after = false;
  start({
    afterDrain() {
      after = true;
      expect(store.pendingInbox("counter-01")).toEqual([]);
    },
  });
  expect(after).toBe(true);
  expect([...timers.values()][0]!.delay).toBe(0);
  wake();
  await idle();
  expect(seen("counter-01").filter((id) => id.startsWith("deadline:"))).toHaveLength(1);
  reopen();
  start();
  expect(seen("counter-01").filter((id) => id.startsWith("deadline:"))).toHaveLength(1);
  time = 100;
  wake();
  await idle();
  expect(seen().filter((id) => id.startsWith("deadline:"))).toHaveLength(0);
});

test("distant deadlines use clamped wakes without firing early, and stop cancels all work", async () => {
  for (const stored of store.activeSnapshots()) {
    const data = structuredClone(stored.snapshot["context"] as Context);
    data.value = "closed";
    delete data.fireAt;
    store.saveSnapshot(write(stored.actorId, data));
  }
  const r = start();
  const data = context();
  data.fireAt = time + 2147483647 + 5;
  r.attach(target("distant", data));
  expect([...timers.values()][0]!.delay).toBe(2147483647);
  time += 2147483647;
  wake();
  expect([...timers.values()][0]!.delay).toBe(5);
  expect(store.pendingInbox("distant")).toEqual([]);
  time += 5;
  wake();
  await idle();
  expect(seen("distant").filter((id) => id.startsWith("deadline:"))).toHaveLength(1);
  r.publish(event());
  r.stop();
  r.stop();
  expect(timers.size).toBe(0);
  await idle();
  expect(seen()).toEqual([]);
  expect(() => r.publish(event())).toThrow(TypeError);
  expect(() => r.persist("distant")).toThrow(TypeError);
  expect(() => r.attach(target("other", context()))).toThrow(TypeError);
});

test("two sources with the same event id remain distinct and an unloaded persist throws", async () => {
  const r = start();
  states.get("counter-00")!.topics = ["weather", "sensor"];
  r.persist("counter-00");
  r.publish(event("same"));
  r.publish({ ...event("same"), source: "sensor", topics: ["sensor.station"] });
  await idle();
  expect(seen()).toEqual(["weather:same", "sensor:same"]);
  expect(() => r.persist("missing")).toThrow(TypeError);
});

test("router schema matches its approved DDL and migrations stay isolated and idempotent", () => {
  start();
  router!.stop();
  start();
  const reference = new DatabaseSync(":memory:");
  reference.exec(
    readFileSync(
      new URL("../../../../docs/specifications/router-database-schema.sql", import.meta.url),
      "utf8",
    ),
  );
  const schema = (db: DatabaseSync) =>
    db
      .prepare("SELECT sql FROM sqlite_schema WHERE name = 'router_source_event'")
      .all()
      .map((row) => String(row["sql"]).replace(/\s+/g, " ").trim());
  expect(schema(store.connection.database)).toEqual(schema(reference));
  reference.close();
  expect(
    store.connection.database.prepare("SELECT * FROM schema_migration ORDER BY owner").all(),
  ).toEqual([
    { owner: "router", version: 1 },
    { owner: "store", version: 3 },
  ]);
});

for (const point of ["published", "sent"])
  test(`SIGKILL after ${point} resumes each target exactly once`, () => {
    store.close();
    const child = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
      const { openStore } = await import(process.argv[1]);
      const { startRouter } = await import(process.argv[2]);
      const store = openStore({ path: process.argv[3], probe(step, row) { if (process.argv[4] === "sent" && step === "sent" && row.eventId === "weather:crash") process.kill(process.pid, "SIGKILL"); } });
      const host = { subscription: (r) => ({ topics: r.snapshot.context.topics, events: ["reading"] }), restore(r) {
        const context = structuredClone(r.snapshot.context);
        return { status: "restored", target: { actorId: r.actorId, send(row) { context.seen.push(row.eventId); }, persist() { return { machine: "counter", snapshot: { status: "active", value: r.snapshot.value, context } }; } } };
      } };
      const router = startRouter({ store, host });
      router.publish({ source: "weather", eventId: "crash", topics: ["weather.station.s1"], event: { type: "reading" } });
      if (process.argv[4] === "published") process.kill(process.pid, "SIGKILL");
    `,
        new URL("../store/index.ts", import.meta.url).href,
        new URL("./index.ts", import.meta.url).href,
        path,
        point,
      ],
      { encoding: "utf8" },
    );
    store = openStore({ path, now: () => time });
    expect(child.stderr).not.toContain("Error:");
    expect(child.signal).toBe("SIGKILL");
    start();
    for (const id of ["counter-00", "counter-01"]) {
      expect(seen(id).filter((value) => value === "weather:crash")).toHaveLength(1);
      expect(store.pendingInbox(id)).toEqual([]);
    }
    reopen();
    start();
    expect(seen().filter((value) => value === "weather:crash")).toHaveLength(1);
  });

test("each committed delivery refreshes subscriptions before the next send, even when the next snapshot errors", () => {
  store.writeInbox({ eventId: "change", topic: "weather", payload: { type: "reading" } }, [
    "counter-00",
  ]);
  store.writeInbox({ eventId: "publish", topic: "weather", payload: { type: "reading" } }, [
    "counter-00",
  ]);
  host.restore = (stored, r) => {
    const data = structuredClone(stored.snapshot["context"] as Context);
    return {
      status: "restored",
      target: {
        ...target(stored.actorId, data),
        send(row) {
          data.seen.push(row.eventId);
          if (row.eventId === "change") data.topics = ["weather.new"];
          if (row.eventId === "publish") {
            expect(r.publish(event("new", ["weather.new"]))).toMatchObject({
              status: "accepted",
              rows: [{ actorId: "counter-00" }],
            });
            data.status = "error";
          }
        },
      },
    };
  };
  const r = start();
  expect(r.publish(event("after-error", ["weather.new"]))).toMatchObject({
    rows: [{ actorId: "counter-00" }],
  });
  expect(store.pendingInbox("counter-00").map((row) => row.eventId)).toEqual([
    "publish",
    "weather:new",
    "weather:after-error",
  ]);
});

test("afterDrain events drain before resume returns and source payloads arrive unchanged", async () => {
  let resumedRouter: Router | undefined;
  const restore = host.restore;
  host.restore = (stored, r) => {
    resumedRouter = r;
    return restore(stored, r);
  };
  const r = start({
    afterDrain() {
      resumedRouter!.publish({
        ...event("after-drain"),
        event: { type: "reading", detail: { units: [1, null, true, "warm"] } },
      });
      expect(seen()).toEqual([]);
    },
  });
  const row = store.connection.database
    .prepare("SELECT payload FROM store_inbox WHERE event_id = ? AND actor_id = ?")
    .get("weather:after-drain", "counter-00")!;
  expect(JSON.parse(row["payload"] as string)).toEqual({
    type: "reading",
    detail: { units: [1, null, true, "warm"] },
  });
  expect(store.pendingInbox("counter-00")).toEqual([]);
  await idle();
  expect(seen()).toEqual(["weather:after-drain"]);
  r.stop();
});

test("absent event list matches any type, but an empty list matches none", () => {
  host.subscription = (record) => ({
    topics: (record.snapshot["context"] as Context).topics,
    ...(record.actorId === "counter-00" ? {} : { events: [] }),
  });
  const r = start();
  expect(r.publish(event("wildcard", undefined, "reading.with.dots"))).toMatchObject({
    rows: [{ actorId: "counter-00" }],
  });
});

test("subscriptions change only from persisted writes, including in-place topic edits", async () => {
  const r = start();
  const data = states.get("counter-00")!;
  r.persist("counter-00");
  data.topics.splice(0, data.topics.length, "weather.new");
  expect(r.publish(event("before"))).toMatchObject({
    rows: expect.arrayContaining([expect.objectContaining({ actorId: "counter-00" })]),
  });
  expect(r.publish(event("before-new", ["weather.new"]))).toMatchObject({ rows: [] });
  r.persist("counter-00");
  expect(r.publish(event("after"))).toMatchObject({ rows: [{ actorId: "counter-01" }] });
  expect(r.publish(event("after-new", ["weather.new"]))).toMatchObject({
    rows: [{ actorId: "counter-00" }],
  });
  await idle();
  expect(seen()).toEqual(["weather:before", "weather:after-new"]);
});

test("terminal actors are removed after delivery; persist and attach can also finish them", async () => {
  const r = start();
  duringSend = (id) => {
    if (id === "counter-00") states.get(id)!.status = "done";
  };
  r.publish(event("finish"));
  await idle();
  expect(r.publish(event("later"))).toMatchObject({ rows: [{ actorId: "counter-01" }] });
  expect(() => r.persist("counter-00")).toThrow(TypeError);
  await idle();
  states.get("counter-01")!.status = "done";
  r.persist("counter-01");
  expect(() => r.persist("counter-01")).toThrow(TypeError);
  const data = context();
  data.status = "done";
  r.attach(target("terminal", data));
  await idle();
  expect(() => r.persist("terminal")).toThrow(TypeError);
});

test("persist errors keep the last subscription and attach errors retain the stored actor", async () => {
  const holds: unknown[] = [];
  const r = start({ onHeld: (held) => holds.push(held) });
  states.get("counter-00")!.status = "error";
  r.persist("counter-00");
  expect(r.publish(event("persist-held"))).toMatchObject({
    rows: expect.arrayContaining([expect.objectContaining({ actorId: "counter-00" })]),
  });
  const data = context();
  data.status = "error";
  r.attach(target("counter-01", data));
  r.publish(event("attach-held"));
  await idle();
  expect(holds).toHaveLength(2);
  expect(store.pendingInbox("counter-01")).toHaveLength(2);
  expect(seen()).toEqual([]);
  expect(store.loadSnapshot("counter-00")?.snapshot.status).toBe("active");
});

test("persist during send is deferred to the delivery save", async () => {
  let writes = 0;
  const restore = host.restore;
  host.restore = (stored, r) => {
    const outcome = restore(stored, r);
    if (outcome.status === "held" || stored.actorId !== "counter-00") return outcome;
    const target = outcome.target;
    return {
      status: "restored",
      target: {
        actorId: stored.actorId,
        send(row) {
          target.send(row);
          r.persist(stored.actorId);
        },
        persist() {
          writes++;
          return target.persist();
        },
      },
    };
  };
  const r = start();
  r.publish(event());
  await idle();
  expect(writes).toBe(1);
  expect(seen()).toEqual(["weather:reading"]);
});

test("attach saves and indexes new actors before live publish; repeated saves retain deadline identity", async () => {
  const r = start();
  const data = context(["weather.new"]);
  data.fireAt = 50;
  const actor = target("new-counter", data);
  r.attach(actor);
  const arm = store.dueDeadlines(50).find((row) => row.actorId === actor.actorId)!;
  time = 20;
  data.fireAt = 60;
  r.attach(actor);
  r.persist(actor.actorId);
  expect(store.dueDeadlines(50).find((row) => row.actorId === actor.actorId)).toEqual(arm);
  expect(r.publish(event("new-actor", ["weather.new"]))).toMatchObject({
    rows: [{ actorId: actor.actorId }],
  });
  expect(seen(actor.actorId)).toEqual([]);
  await idle();
  expect(seen(actor.actorId)).toEqual(["weather:new-actor"]);
});

test("delivery re-arms the deadline loop from newly saved arms", async () => {
  const r = start();
  duringSend = (id) => {
    if (id === "counter-01") {
      const data = states.get(id)!;
      data.value = "idle";
      data.fireAt = 20;
    }
  };
  r.publish(event());
  await idle();
  expect(timers.size).toBe(1);
  expect([...timers.values()][0]!.delay).toBe(10);
  time = 20;
  wake();
  await idle();
  expect(seen("counter-01").filter((id) => id.startsWith("deadline:"))).toHaveLength(1);
});

test("release restores a held actor and drains its pending inbox without restarting", async () => {
  let restores = 0;
  const restore = host.restore;
  host.restore = (...args) => {
    if (args[0].actorId === "counter-00") restores++;
    return restore(...args);
  };
  store.saveSnapshot(write("counter-00", context()));
  held.add("counter-00");
  const router = start();
  router.publish(event());
  expect(store.pendingInbox("counter-00")).toHaveLength(1);
  held.delete("counter-00");
  router.release("counter-00");
  await idle();
  expect(seen()).toEqual(["weather:reading"]);
  expect(store.pendingInbox("counter-00")).toHaveLength(0);
  router.release("counter-00");
  await idle();
  expect(seen()).toEqual(["weather:reading"]);
  expect(restores).toBe(2);
});
