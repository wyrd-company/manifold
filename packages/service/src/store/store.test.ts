// ---
// relationships:
//   verifies: store
// ---
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { openStore } from "./index.ts";
import type { Store, DeliveryTarget, SnapshotWrite, DeadlineArm } from "./index.ts";

let directory: string;
let path: string;
let store: Store;
let clock: number;
const snapshot = (value: string = "idle") => ({
  status: "active" as const,
  value,
  context: { total: 0, applied: [] as string[] },
});
const event = (eventId: string) => ({ eventId, topic: "counter.add", payload: { amount: 3 } });
const arm = (statePath = "idle", entryId = "entry-a", fireAt = 100): DeadlineArm => ({
  statePath,
  entryId,
  fireAt,
  eventName: "tick",
});

function counter(actorId: string, deadlines?: readonly DeadlineArm[]) {
  const saved = store.loadSnapshot(actorId)?.snapshot;
  const context = saved?.["context"] as { total: number; applied: string[] } | undefined;
  let total = context?.total ?? 0;
  const applied = [...(context?.applied ?? [])];
  let calls = 0;
  const target: DeliveryTarget = {
    actorId,
    send(row) {
      calls++;
      if (!applied.includes(row.eventId)) {
        const payload = row.payload as { amount?: number };
        total += payload.amount ?? 1;
        applied.push(row.eventId);
      }
    },
    persist: () => ({
      machine: "counter",
      snapshot: { status: "active", value: "idle", context: { total, applied } },
      ...(deadlines ? { deadlines } : {}),
    }),
  };
  return { target, calls: () => calls, total: () => total };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "store-test-"));
  path = join(directory, "data.sqlite");
  clock = 10;
  store = openStore({ path, now: () => clock });
  for (let i = 0; i < 20; i++) {
    const actorId = `counter-${String(i).padStart(2, "0")}`;
    store.saveSnapshot({
      actorId,
      machine: i === 19 ? "other" : "counter",
      snapshot: snapshot(i % 2 ? "idle" : "running"),
      deadlines: [arm(i % 2 ? "idle" : "running")],
    });
    store.writeInbox(event("seed"), [actorId]);
    if (i % 2 === 0) store.markConsumed(actorId, "seed");
  }
});
afterEach(() => {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
});

test("schema matches the approved SQL and connection pragmas", () => {
  const reference = new DatabaseSync(join(directory, "reference.sqlite"));
  reference.exec(
    readFileSync(
      new URL("../../../../docs/specifications/store-database-schema.sql", import.meta.url),
      "utf8",
    ),
  );
  const schema = (database: DatabaseSync) =>
    database
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name IN ('schema_migration', 'sqlite_sequence') OR name LIKE 'store_%' ORDER BY name",
      )
      .all()
      .map((row) => ({
        ...row,
        sql: typeof row["sql"] === "string" ? row["sql"].replace(/\s+/g, " ").trim() : row["sql"],
      }));
  expect(schema(store.connection.database)).toEqual(schema(reference));
  expect(store.connection.database.prepare("SELECT * FROM schema_migration").all()).toEqual([
    { owner: "store", version: 1 },
  ]);
  expect(store.connection.database.prepare("PRAGMA journal_mode").get()?.["journal_mode"]).toBe(
    "wal",
  );
  expect(store.connection.database.prepare("PRAGMA synchronous").get()?.["synchronous"]).toBe(2);
  expect(store.connection.database.prepare("PRAGMA foreign_keys").get()?.["foreign_keys"]).toBe(1);
  reference.close();
});

test("owner migrations are atomic, idempotent, isolated and reject invalid owners or later versions", () => {
  const { connection } = store;
  const steps = ["CREATE TABLE auxiliary_entry (value INTEGER) STRICT;"];
  connection.migrate("auxiliary", steps);
  connection.migrate("auxiliary", steps);
  expect(
    connection.database
      .prepare("SELECT version FROM schema_migration WHERE owner = 'store'")
      .get()?.["version"],
  ).toBe(1);
  expect(() => connection.migrate("Auxiliary", steps)).toThrow(TypeError);
  expect(() => connection.migrate("", steps)).toThrow(TypeError);
  expect(() => connection.migrate("auxiliary", [])).toThrow(/auxiliary.*1.*0/);
  expect(() =>
    connection.migrate("broken", ["CREATE TABLE broken_entry (value INTEGER);", "INVALID SQL"]),
  ).toThrow();
  expect(
    connection.database.prepare("SELECT name FROM sqlite_schema WHERE name='broken_entry'").get(),
  ).toBeUndefined();
  expect(
    connection.database.prepare("SELECT * FROM schema_migration WHERE owner='broken'").get(),
  ).toBeUndefined();
});

test("nested transactions share commits, rollbacks and reject thenables", () => {
  const { connection } = store;
  connection.migrate("auxiliary", ["CREATE TABLE auxiliary_entry (value INTEGER) STRICT;"]);
  const insert = () => connection.database.prepare("INSERT INTO auxiliary_entry VALUES (1)").run();
  connection.transaction(() => {
    insert();
    connection.transaction(() => store.writeInbox(event("committed"), ["counter-00"]));
  });
  expect(store.pendingInbox("counter-00").map((row) => row.eventId)).toEqual(["committed"]);
  expect(() =>
    connection.transaction(() => {
      insert();
      store.writeInbox(event("rolled-back"), ["counter-00"]);
      throw new Error("stop");
    }),
  ).toThrow("stop");
  connection.transaction(() => {
    expect(() =>
      connection.transaction(() => {
        insert();
        throw new Error("inner");
      }),
    ).toThrow("inner");
    store.writeInbox(event("outer-survives"), ["counter-00"]);
  });
  expect(connection.database.prepare("SELECT * FROM auxiliary_entry").all()).toHaveLength(1);
  expect(() =>
    connection.transaction(() => {
      insert();
      // oxlint-disable-next-line unicorn/no-thenable -- Exercise the synchronous transaction boundary.
      return { then() {} };
    }),
  ).toThrow(TypeError);
  expect(connection.database.prepare("SELECT * FROM auxiliary_entry").all()).toHaveLength(1);
  expect(store.pendingInbox("counter-00").map((row) => row.eventId)).toEqual([
    "committed",
    "outer-survives",
  ]);
});

test("snapshot state paths include ancestors, parallel regions and empty nodes with machine filtering", () => {
  store.saveSnapshot({
    actorId: "parallel",
    machine: "counter",
    snapshot: {
      status: "done",
      value: { open: { lifecycle: "ready", budget: "reserved", empty: {} } },
    },
  });
  for (const statePath of [
    "open",
    "open.lifecycle",
    "open.lifecycle.ready",
    "open.budget",
    "open.budget.reserved",
    "open.empty",
  ])
    expect(
      store.findActorsInState({ machine: "counter", statePath }).map((row) => row.actorId),
    ).toEqual(["parallel"]);
  expect(
    store.findActorsInState({ machine: "counter", statePath: "idle" }).map((row) => row.actorId),
  ).toEqual(Array.from({ length: 9 }, (_, i) => `counter-${String(i * 2 + 1).padStart(2, "0")}`));
  store.saveSnapshot({
    actorId: "parallel",
    machine: "other",
    snapshot: { status: "stopped", value: "closed" },
  });
  expect(store.findActorsInState({ machine: "counter", statePath: "open" })).toEqual([]);
  expect(store.loadSnapshot("missing")).toBeUndefined();
});

test("errored snapshots preserve the active snapshot, state paths and deadlines", () => {
  const previous = store.loadSnapshot("counter-00");
  const due = store.dueDeadlines(100);
  expect(
    store.saveSnapshot({
      actorId: "counter-00",
      machine: "counter",
      snapshot: { status: "error", error: "failed" },
      eventId: "bad",
    }),
  ).toBe("errored");
  expect(store.loadSnapshot("counter-00")).toEqual(previous);
  expect(store.dueDeadlines(100)).toEqual(due);
  expect(store.findActorsInState({ machine: "counter", statePath: "running" })).toContainEqual(
    previous,
  );
  expect(store.loadErroredSnapshot("counter-00")?.eventId).toBe("bad");
  store.saveSnapshot({ actorId: "new", machine: "counter", snapshot: { status: "error" } });
  expect(store.loadSnapshot("new")).toBeUndefined();
  expect(store.loadErroredSnapshot("new")?.eventId).toBeUndefined();
  expect(store.loadErroredSnapshot("missing")).toBeUndefined();
});

test("inbox deduplicates each actor and event, preserves insertion order and first consumption time", () => {
  const rows = store.writeInbox(event("new"), ["counter-00", "counter-01", "counter-00"]);
  expect(rows.map((row) => row.actorId)).toEqual(["counter-00", "counter-01"]);
  expect(store.writeInbox(event("new"), ["counter-00"])).toEqual([]);
  expect(store.pendingInbox("counter-01").map((row) => row.eventId)).toEqual(["seed", "new"]);
  store.markConsumed("counter-00", "new");
  clock = 20;
  store.markConsumed("counter-00", "new");
  store.markConsumed("counter-00", "missing");
  expect(
    store.connection.database
      .prepare("SELECT consumed_at FROM store_inbox WHERE actor_id='counter-00' AND event_id='new'")
      .get()?.["consumed_at"],
  ).toBe(10);
  expect(store.deliver(counter("counter-00").target, rows[0]!)).toBe("already-consumed");
  expect(store.writeInbox(event("new"), ["counter-00"])).toEqual([]);
});

test("delivery rejects another actor and stops a drain on an error without overtaking", () => {
  const row = store.writeInbox(event("first"), ["counter-00"])[0]!;
  store.writeInbox(event("second"), ["counter-00"]);
  expect(() => store.deliver(counter("different").target, row)).toThrow(TypeError);
  const target: DeliveryTarget = {
    actorId: "counter-00",
    send() {},
    persist: () => ({ machine: "counter", snapshot: { status: "error" } }),
  };
  expect(store.drain(target)).toEqual({ delivered: 0, erroredAt: row });
  expect(store.loadErroredSnapshot("counter-00")?.eventId).toBe("first");
  expect(store.pendingInbox("counter-00").map((row) => row.eventId)).toEqual(["first", "second"]);
});

test("drain includes rows written during delivery and a consumed delivery calls nothing", () => {
  const row = store.writeInbox(event("first"), ["counter-00"])[0]!;
  const current = counter("counter-00");
  const target: DeliveryTarget = {
    ...current.target,
    send(row) {
      current.target.send(row);
      if (row.eventId === "first") store.writeInbox(event("second"), ["counter-00"]);
    },
  };
  expect(store.drain(target)).toEqual({ delivered: 2, erroredAt: undefined });
  expect(store.deliver(target, row)).toBe("already-consumed");
  expect(current.calls()).toBe(2);
  expect(current.total()).toBe(6);
});

for (const step of ["written", "sent", "saved"] as const)
  test(`restart recovers a crash after ${step} and a second drain is empty`, () => {
    store.writeInbox(event("recover"), ["counter-00"]);
    store.close();
    store = openStore({
      path,
      probe(observed) {
        if (observed === step) throw new Error("crash");
      },
    });
    if (step !== "written")
      expect(() => store.drain(counter("counter-00").target)).toThrow("crash");
    store.close();
    store = openStore({ path });
    const restored = counter("counter-00");
    expect(store.drain(restored.target)).toEqual({ delivered: 1, erroredAt: undefined });
    expect(restored.total()).toBe(3);
    expect(store.drain(restored.target).delivered).toBe(0);
    expect(restored.calls()).toBe(1);
  });

test("SIGKILL inside snapshot transaction leaves the old snapshot and pending inbox recoverable", () => {
  store.writeInbox(event("recover"), ["counter-00"]);
  store.close();
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `const { openStore } = await import(process.argv[1]);
     const store = openStore({ path: process.argv[2], probe(step) { if (step === "saved") process.kill(process.pid, "SIGKILL"); } });
     store.drain({ actorId: "counter-00", send() {}, persist: () => ({ machine: "counter", snapshot: { status: "active", value: "idle", context: { total: 3, applied: ["recover"] } } }) });
     throw new Error("Expected SIGKILL");`,
      new URL("./index.ts", import.meta.url).href,
      path,
    ],
    { encoding: "utf8" },
  );
  store = openStore({ path });
  expect(child.stderr).not.toContain("Error:");
  expect(child.signal).toBe("SIGKILL");
  expect(store.loadSnapshot("counter-00")?.snapshot["context"]).toEqual({ total: 0, applied: [] });
  const restored = counter("counter-00");
  expect(store.drain(restored.target).delivered).toBe(1);
  expect(restored.total()).toBe(3);
  expect(store.drain(restored.target).delivered).toBe(0);
});

function saveWithDeadlines(
  deadlines: readonly DeadlineArm[],
  value: SnapshotWrite["snapshot"] = snapshot(),
) {
  return store.saveSnapshot({ actorId: "timer", machine: "counter", snapshot: value, deadlines });
}
function timerDeadline() {
  return store.dueDeadlines(1000).find((row) => row.actorId === "timer")!;
}

test("deadlines retain first fire time, replace on re-entry and survive restart", () => {
  saveWithDeadlines([arm()]);
  const first = timerDeadline();
  saveWithDeadlines([arm("idle", "entry-a", 200)]);
  expect(timerDeadline()).toEqual(first);
  saveWithDeadlines([arm("idle", "entry-b", 300)]);
  const second = timerDeadline();
  expect(second.fireAt).toBe(300);
  expect(second.deadlineId).toBeGreaterThan(first.deadlineId);
  saveWithDeadlines([arm("idle", "entry-b", 400)]);
  expect(timerDeadline()).toEqual(second);
  expect(store.fireDeadline(first, "counter.tick")).toBeUndefined();
  store.close();
  store = openStore({ path });
  expect(timerDeadline()).toEqual(second);
  expect(store.dueDeadlines(299).some((row) => row.actorId === "timer")).toBe(false);
});

test("leaving states removes only their deadlines and invalid arms write nothing", () => {
  saveWithDeadlines([arm("open.left"), arm("open.right")], {
    status: "active",
    value: { open: { left: {}, right: {} } },
  });
  const first = store.dueDeadlines(100).filter((row) => row.actorId === "timer");
  saveWithDeadlines([arm("open.right", "entry-a", 500)], {
    status: "active",
    value: { open: { right: {} } },
  });
  expect(store.dueDeadlines(100).filter((row) => row.actorId === "timer")).toEqual(
    first.filter((row) => row.statePath === "open.right"),
  );
  expect(
    store.fireDeadline(
      first.find((row) => row.statePath === "open.left")!,
      "counter.tick",
    ),
  ).toBeUndefined();
  const saved = store.loadSnapshot("timer");
  expect(() => saveWithDeadlines([arm("absent")])).toThrow(RangeError);
  expect(store.loadSnapshot("timer")).toEqual(saved);
  expect(store.dueDeadlines(100).filter((row) => row.actorId === "timer")).toEqual(
    first.filter((row) => row.statePath === "open.right"),
  );
});

test("fired entries stay fired through repeated saves, delivery and restart; recurrence fires a new arm", () => {
  saveWithDeadlines([arm()]);
  const first = timerDeadline();
  const row = store.fireDeadline(first, "counter.tick")!;
  expect(row.eventId).toBe(`deadline:${first.deadlineId}`);
  expect(row.payload).toEqual({ type: "tick" });
  saveWithDeadlines([arm("idle", "entry-a", 300)]);
  expect(store.fireDeadline(first, "counter.tick")).toBeUndefined();
  expect(store.dueDeadlines(1000).some((row) => row.actorId === "timer")).toBe(false);
  store.close();
  store = openStore({ path });
  const restored = counter("timer", [arm()]);
  expect(store.drain(restored.target).delivered).toBe(1);
  expect(restored.total()).toBe(1);
  expect(store.drain(restored.target).delivered).toBe(0);
  expect(store.dueDeadlines(1000).some((row) => row.actorId === "timer")).toBe(false);
  saveWithDeadlines([arm("idle", "entry-b")]);
  const second = timerDeadline();
  expect(second.deadlineId).toBeGreaterThan(first.deadlineId);
  expect(store.fireDeadline(first, "counter.tick")).toBeUndefined();
  expect(store.fireDeadline(second, "counter.tick")?.eventId).not.toBe(row.eventId);
  expect(store.fireDeadline(second, "counter.tick")).toBeUndefined();
  expect(store.pendingInbox("timer")).toHaveLength(1);
});

test("deadline identities do not collide for punctuation in state paths and event names", () => {
  saveWithDeadlines(
    [
      { ...arm("phase.one"), eventName: "tick" },
      { ...arm("phase"), eventName: "one:tick" },
      { ...arm("phase:one"), eventName: "tick" },
    ],
    { status: "active", value: { phase: "one", "phase:one": {} } },
  );
  const deadlines = store.dueDeadlines(100).filter((row) => row.actorId === "timer");
  const rows = deadlines.map((row) => store.fireDeadline(row, "counter.tick")!);
  expect(new Set(rows.map((row) => row.eventId)).size).toBe(3);
  expect(store.pendingInbox("timer")).toHaveLength(3);
});

test("inbox fan-out rolls back every new row when one insert fails", () => {
  const failure = () => store.writeInbox(event("partial"), ["counter-00", ""]);
  expect(failure).toThrow();
  expect(store.pendingInbox("counter-00")).toEqual([]);
  expect(store.writeInbox(event("partial"), ["counter-00"])).toHaveLength(1);
});

test("deadline firing rolls back fired time when inbox writing fails", () => {
  saveWithDeadlines([arm()]);
  const deadline = timerDeadline();
  expect(() => store.fireDeadline(deadline, "")).toThrow();
  expect(timerDeadline()).toEqual(deadline);
  expect(store.pendingInbox("timer")).toEqual([]);
  clock = 50;
  const row = store.fireDeadline(deadline, "counter.tick")!;
  clock = 60;
  expect(store.fireDeadline(deadline, "counter.tick")).toBeUndefined();
  expect(
    store.connection.database
      .prepare("SELECT fired_at FROM store_deadline WHERE deadline_id = ?")
      .get(deadline.deadlineId)?.["fired_at"],
  ).toBe(50);
  expect(row.receivedAt).toBe(50);
});

test("due deadlines are ordered by fire time then actor id, including the boundary", () => {
  store.saveSnapshot({
    actorId: "alpha",
    machine: "counter",
    snapshot: snapshot(),
    deadlines: [arm("idle", "entry-a", 40)],
  });
  store.saveSnapshot({
    actorId: "omega",
    machine: "counter",
    snapshot: snapshot(),
    deadlines: [arm("idle", "entry-a", 30)],
  });
  store.saveSnapshot({
    actorId: "beta",
    machine: "counter",
    snapshot: snapshot(),
    deadlines: [arm("idle", "entry-a", 40)],
  });
  expect(store.dueDeadlines(29)).toEqual([]);
  expect(store.dueDeadlines(40).map((row) => row.actorId)).toEqual(["omega", "alpha", "beta"]);
});

test("opening a newer store schema refuses it without altering persisted data", () => {
  store.connection.database
    .prepare("UPDATE schema_migration SET version = 5 WHERE owner = 'store'")
    .run();
  const previous = store.loadSnapshot("counter-00");
  store.close();
  expect(() => openStore({ path })).toThrow(/store.*5.*1/);
  const database = new DatabaseSync(path);
  expect(
    database.prepare("SELECT version FROM schema_migration WHERE owner='store'").get()?.["version"],
  ).toBe(5);
  database.prepare("UPDATE schema_migration SET version = 1 WHERE owner = 'store'").run();
  database.close();
  store = openStore({ path });
  expect(store.loadSnapshot("counter-00")).toEqual(previous);
});

test("snapshot re-save updates time and omitted arms retire deadlines", () => {
  saveWithDeadlines([arm()]);
  clock = 70;
  store.saveSnapshot({ actorId: "timer", machine: "counter", snapshot: snapshot() });
  expect(store.loadSnapshot("timer")?.savedAt).toBe(70);
  expect(timerDeadline()).toBeUndefined();
});

test("a send failure leaves the snapshot and pending row unchanged", () => {
  const row = store.writeInbox(event("send-failure"), ["counter-00"])[0]!;
  const previous = store.loadSnapshot("counter-00");
  const failure = new Error("send failed");
  const target: DeliveryTarget = {
    actorId: "counter-00",
    send() {
      throw failure;
    },
    persist() {
      throw new Error("must not persist");
    },
  };
  expect(() => store.deliver(target, row)).toThrow(failure);
  expect(store.loadSnapshot("counter-00")).toEqual(previous);
  expect(store.pendingInbox("counter-00")).toEqual([row]);
});

test("deadline arms have distinct event identities across actors", () => {
  saveWithDeadlines([arm()]);
  store.saveSnapshot({
    actorId: "timer-other",
    machine: "counter",
    snapshot: snapshot(),
    deadlines: [arm()],
  });
  const deadlines = store.dueDeadlines(100).filter((row) => row.actorId.startsWith("timer"));
  const rows = deadlines.map((row) => store.fireDeadline(row, "counter.tick")!);
  expect(new Set(rows.map((row) => row.eventId)).size).toBe(2);
  expect(rows.map((row) => row.actorId)).toEqual(["timer", "timer-other"]);
});

test("active snapshots are ordered and terminal actors are excluded; earliest deadline excludes fired rows", () => {
  store.saveSnapshot({
    actorId: "counter-00",
    machine: "counter",
    snapshot: { status: "done", value: "closed" },
  });
  store.saveSnapshot({
    actorId: "counter-01",
    machine: "counter",
    snapshot: { status: "stopped", value: "closed" },
  });
  store.saveSnapshot({
    actorId: "ahead",
    machine: "counter",
    snapshot: snapshot(),
    deadlines: [arm("idle", "entry-a", 40)],
  });
  expect(store.activeSnapshots().map((row) => row.actorId)).toEqual([
    "ahead",
    ...Array.from({ length: 18 }, (_, i) => `counter-${String(i + 2).padStart(2, "0")}`),
  ]);
  expect(store.nextDeadlineAt()).toBe(40);
  store.fireDeadline(store.dueDeadlines(40)[0]!, "deadline.tick");
  expect(store.nextDeadlineAt()).toBe(100);
  for (const row of store.dueDeadlines(100)) store.fireDeadline(row, "deadline.tick");
  expect(store.nextDeadlineAt()).toBeUndefined();
});

test("root deadlines are active and unlisted arms are retired on each save", () => {
  const write = { actorId: "root-delay", machine: "parcel", snapshot: snapshot() };
  store.saveSnapshot({ ...write, deadlines: [arm("", "1", 50)] });
  expect(store.dueDeadlines(50).filter((row) => row.actorId === write.actorId)).toHaveLength(1);
  store.saveSnapshot({ ...write, deadlines: [] });
  expect(store.dueDeadlines(50).filter((row) => row.actorId === write.actorId)).toEqual([]);
});

test("saved hooks share the delivery transaction and precede the saved probe", () => {
  const actorId = "hooked";
  const { target } = counter(actorId);
  store.saveSnapshot({ actorId, ...target.persist() });
  const [row] = store.writeInbox(event("hook"), [actorId]);
  const before = store.loadSnapshot(actorId);
  expect(() =>
    store.deliver(
      {
        ...target,
        saved() {
          throw new Error("hook failed");
        },
      },
      row!,
    ),
  ).toThrow("hook failed");
  expect(store.loadSnapshot(actorId)).toEqual(before);
  expect(store.pendingInbox(actorId)).toHaveLength(1);
});

test("fresh deadlines accept the root state and never reuse deleted ids", () => {
  store.connection.database.exec(
    "INSERT INTO store_deadline (deadline_id, actor_id, state_path, event_name, fire_at, entry_id) VALUES (500, 'timer', 'idle', 'tick', 100, '1'); DELETE FROM store_deadline;",
  );
  store.saveSnapshot({
    actorId: "timer",
    machine: "parcel",
    snapshot: snapshot(),
    deadlines: [arm("", "1")],
  });
  expect(store.dueDeadlines(100)[0]?.deadlineId).toBe(501);
  expect(store.dueDeadlines(100)[0]?.statePath).toBe("");
});

test("deadline retirement uses complete identities even when names contain delimiters", () => {
  const first = { ...arm(), eventName: "tick\0entry", entryId: "tail" };
  const second = { ...arm(), eventName: "tick", entryId: "entry\0tail" };
  saveWithDeadlines([first, second]);
  saveWithDeadlines([first]);
  expect(store.dueDeadlines(100).filter((row) => row.actorId === "timer")).toMatchObject([first]);
});
test("migration failures persist, deduplicate a pair, roll back, and clear after leaving the failed-from version", () => {
  const failure = {
    actorId: "counter-00",
    from: "old",
    to: "new",
    kind: "no-path" as const,
    message: "No compatible context",
    detail: { field: "zone" },
  };
  expect(store.recordMigrationFailure(failure)).toBe("recorded");
  const first = store.migrationFailure(failure.actorId)!;
  expect(store.recordMigrationFailure({ ...failure, message: "Repeated attempt" })).toBe(
    "unchanged",
  );
  expect(store.migrationFailure(failure.actorId)).toEqual(first);
  store.close();
  store = openStore({ path });
  expect(store.migrationFailure(failure.actorId)).toEqual(first);
  expect(() =>
    store.connection.transaction(() => {
      store.clearMigrationFailures("new");
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(store.migrationFailures("new")).toEqual([first]);
  store.saveSnapshot({
    actorId: failure.actorId,
    machine: "old",
    snapshot: { status: "active", value: "counting", context: {} },
  });
  expect(store.migrationFailures("new")).toHaveLength(1);
  store.saveSnapshot({
    actorId: failure.actorId,
    machine: "later",
    snapshot: { status: "active", value: "counting", context: { zone: "north" } },
  });
  expect(store.migrationFailure(failure.actorId)).toBeUndefined();
  expect(store.recordMigrationFailure(failure)).toBe("recorded");
  expect(store.clearMigrationFailures("new")).toBe(1);
  expect(store.clearMigrationFailures("new")).toBe(0);
});

test.each(["done", "stopped"] as const)(
  "a %s save clears the migration failure on the original version",
  (status) => {
    const failure = {
      actorId: "counter-00",
      from: "old",
      to: "new",
      kind: "no-path" as const,
      message: "No path",
      detail: {},
    };
    store.recordMigrationFailure(failure);
    const before = store.migrationFailure(failure.actorId);
    expect(() =>
      store.connection.transaction(() => {
        store.saveSnapshot({
          actorId: failure.actorId,
          machine: "old",
          snapshot: { status, value: "counting", context: {} },
        });
        throw new Error("rollback");
      }),
    ).toThrow("rollback");
    expect(store.migrationFailure(failure.actorId)).toEqual(before);
    store.saveSnapshot({
      actorId: failure.actorId,
      machine: "old",
      snapshot: { status, value: "counting", context: {} },
    });
    expect(store.migrationFailure(failure.actorId)).toBeUndefined();
  },
);
