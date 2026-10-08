// ---
// relationships:
//   verifies: [actor-history, history-database-schema]
// ---
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import type { ActorSave } from "../actor-host/index.ts";
import { openHistory } from "./index.ts";
import { historySteps } from "./migrations.ts";
let root: string;
let store: ReturnType<typeof openStore>;
let history: ReturnType<typeof openHistory>;
let at = 1000;
const logs: unknown[] = [];
const machine = `${"a".repeat(40)}:blueprints/parcel.yml`;
const command = {
  implementation: "turn-start" as const,
  commandId: "command-one",
  invocation: { actorId: "parcel", invokeId: "send", entryId: "1" },
  environment: "station",
  threadId: "thread-one",
  messageId: "message-one",
};
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "history-"));
  store = openStore({ path: join(root, "state.sqlite"), now: () => at });
  store.saveSnapshot({
    actorId: "other",
    machine,
    snapshot: { status: "done", value: "delivered" },
  });
  store.writeInbox(
    { eventId: "other-event", topic: "parcel.other", payload: { type: "scanned" } },
    ["other"],
  );
  store.markConsumed("other", "other-event");
  at = 1000;
  logs.length = 0;
  history = openHistory({ store, now: () => at, log: (entry) => logs.push(entry) });
});
afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});
function save(value: ActorSave["snapshot"], extra: Partial<ActorSave> = {}) {
  const write = {
    actorId: "parcel",
    machine,
    snapshot: value,
    activeInvokes: [],
    entered: [],
    entries: {},
    ...extra,
  };
  store.connection.transaction(() => {
    store.saveSnapshot(write);
    history.saveHook(write);
    if (write.eventId) store.markConsumed("parcel", write.eventId);
  });
}
test("migration matches the specified schema and rejects invalid records", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON");
    db.exec(
      readFileSync(
        new URL("../../../../docs/specifications/history-database-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    const schema = (database: DatabaseSync) =>
      database
        .prepare(
          "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name LIKE 'history_%' ORDER BY name",
        )
        .all()
        .map((row) => ({ ...row, sql: String(row["sql"]).replace(/\s+/g, " ") }));
    expect(schema(store.connection.database)).toEqual(schema(db));
    store.connection.migrate("history", historySteps);
    expect(() =>
      db.exec(
        "INSERT INTO history_visit VALUES ('parcel',1,'machine','\"ready\"',1,NULL,'scanned',NULL)",
      ),
    ).toThrow();
    expect(() =>
      db.exec(
        "INSERT INTO history_visit VALUES ('parcel',1,'machine','\"ready\"',1,2,NULL,'event')",
      ),
    ).toThrow();
    expect(() => db.exec("INSERT INTO history_event VALUES ('parcel','event',1)")).toThrow();
    expect(() =>
      db.exec(
        "INSERT INTO history_command VALUES ('command','parcel','turn-start','send','1','station','thread',NULL,'message',1,2,NULL)",
      ),
    ).toThrow();
  } finally {
    db.close();
  }
});
test("records visits, event links, blueprint changes, pending events and the end without copying payloads", () => {
  save({ status: "active", value: "packing", context: { manifold: { issue: "parcel-node" } } });
  at = 2000;
  store.writeInbox(
    { eventId: "scan", topic: "parcel.scan", payload: { type: "scanned", label: "large" } },
    ["parcel"],
  );
  save(
    { status: "active", value: "ready" },
    { eventId: "scan", changedBy: { type: "scanned", eventId: "scan" } },
  );
  at = 3000;
  store.writeInbox({ eventId: "repeat", topic: "parcel.scan", payload: { type: "repeat" } }, [
    "parcel",
  ]);
  save({ status: "active", value: "ready" }, { eventId: "repeat" });
  save(
    { status: "active", value: "ready" },
    { machine: `${"b".repeat(40)}:blueprints/parcel.yml` },
  );
  at = 4000;
  save(
    { status: "done", value: "delivered", output: { label: "large" } },
    {
      machine: `${"b".repeat(40)}:blueprints/parcel.yml`,
      changedBy: { type: "xstate.done.actor.ship" },
    },
  );
  store.writeInbox({ eventId: "pending", topic: "parcel.scan", payload: { type: "late" } }, [
    "parcel",
  ]);
  const result = history.read("parcel")!;
  expect(result.visits.map((v) => [v.visit, v.value, v.exitEvent])).toEqual([
    [1, "packing", { type: "scanned", eventId: "scan" }],
    [2, "ready", undefined],
    [3, "ready", { type: "xstate.done.actor.ship" }],
    [4, "delivered", undefined],
  ]);
  expect(result.visits.map((v) => v.blueprint?.commit)).toEqual([
    "a".repeat(40),
    "a".repeat(40),
    "b".repeat(40),
    "b".repeat(40),
  ]);
  expect(result.events).toEqual([
    {
      eventId: "scan",
      type: "scanned",
      topic: "parcel.scan",
      payload: { type: "scanned", label: "large" },
      receivedAt: new Date(2000).toISOString(),
      consumedAt: new Date(2000).toISOString(),
      visit: 1,
    },
    expect.objectContaining({ eventId: "repeat", visit: 2 }),
    {
      eventId: "pending",
      type: "late",
      topic: "parcel.scan",
      payload: { type: "late" },
      receivedAt: new Date(4000).toISOString(),
    },
  ]);
  expect(result.end).toEqual({
    status: "done",
    endedAt: new Date(4000).toISOString(),
    output: { label: "large" },
  });
  expect(store.endedSnapshots().map((s) => s.actorId)).toEqual(["other", "parcel"]);
  expect(history.read("missing")).toBeUndefined();
});
test("rollback preserves the old visit and writes each replayed link once", () => {
  save({ status: "active", value: "packing" });
  store.writeInbox({ eventId: "scan", topic: "parcel.scan", payload: { type: "scanned" } }, [
    "parcel",
  ]);
  const write: ActorSave = {
    actorId: "parcel",
    machine,
    snapshot: { status: "active", value: "ready" },
    activeInvokes: [],
    entered: [],
    entries: {},
    eventId: "scan",
    changedBy: { type: "scanned", eventId: "scan" },
  };
  expect(() =>
    store.connection.transaction(() => {
      store.saveSnapshot(write);
      history.saveHook(write);
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(history.read("parcel")!.visits).toHaveLength(1);
  expect(history.read("parcel")!.events[0]).not.toHaveProperty("visit");
  save(write.snapshot, write);
  save(write.snapshot, write);
  expect(history.read("parcel")!.visits).toHaveLength(2);
  expect(
    store.connection.database.prepare("SELECT * FROM history_event WHERE actor_id='parcel'").all(),
  ).toHaveLength(1);
});
test("reads pre-history ended actors with output and consumed events but no visits", () => {
  expect(history.read("other")).toMatchObject({
    actor: { status: "done" },
    end: { status: "done" },
    visits: [],
    commands: [],
    events: [{ eventId: "other-event", consumedAt: expect.any(String) }],
  });
  expect(history.read("other")!.events[0]).not.toHaveProperty("visit");
});
test("commands converge, retain first timestamps and derive a turn from inbox order", () => {
  save({ status: "active", value: "packing" });
  history.commandSending(command);
  at = 2000;
  history.commandSending(command);
  history.commandAccepted({ ...command, sequence: 3 });
  at = 3000;
  history.commandAccepted({ ...command, sequence: 4 });
  store.writeInbox(
    {
      eventId: "wrong-thread",
      topic: "t3.station.other",
      payload: {
        type: "t3.turn.started",
        threadId: "other",
        messageId: "message-one",
        turnId: "wrong-thread",
      },
    },
    ["parcel"],
  );
  store.writeInbox(
    {
      eventId: "wrong-message",
      topic: "t3.station.thread-one",
      payload: {
        type: "t3.turn.started",
        threadId: "thread-one",
        messageId: "other",
        turnId: "wrong-message",
      },
    },
    ["parcel"],
  );
  store.writeInbox(
    {
      eventId: "started",
      topic: "t3.station.thread-one",
      payload: {
        type: "t3.turn.started",
        threadId: "thread-one",
        messageId: "message-one",
        turnId: "turn-one",
      },
    },
    ["parcel"],
  );
  expect(history.read("parcel")!.commands).toEqual([
    {
      commandId: "command-one",
      kind: "turn-start",
      environment: "station",
      threadId: "thread-one",
      messageId: "message-one",
      turnId: "turn-one",
      invokeId: "send",
      entryId: "1",
      sentAt: new Date(1000).toISOString(),
      acceptedAt: new Date(2000).toISOString(),
    },
  ]);
});
test.each([false, true])(
  "failed sending keeps its first time through acceptance, save retry and rollback (acceptance fails: %s)",
  (fails) => {
    save({ status: "active", value: "packing" });
    const db = store.connection.database;
    db.exec(
      "CREATE TRIGGER reject_command BEFORE INSERT ON history_command BEGIN SELECT RAISE(FAIL,'fixture fault'); END",
    );
    history.commandSending(command);
    expect(logs).toHaveLength(1);
    at = 2000;
    if (!fails) db.exec("DROP TRIGGER reject_command");
    history.commandAccepted({ ...command, sequence: 3 });
    if (fails) {
      expect(() => save({ status: "active", value: "ready" })).toThrow("fixture fault");
      expect(store.loadSnapshot("parcel")!.snapshot.value).toBe("packing");
      db.exec("DROP TRIGGER reject_command");
      expect(() =>
        store.connection.transaction(() => {
          save({ status: "active", value: "ready" });
          throw new Error("later hook");
        }),
      ).toThrow("later hook");
      expect(history.read("parcel")!.commands).toEqual([]);
    }
    at = 3000;
    history.commandSending({ ...command, commandId: "command-two" });
    save({ status: "active", value: "ready" });
    save({ status: "active", value: "ready" });
    expect(
      history.read("parcel")!.commands.map((c) => [c.commandId, c.sentAt, c.acceptedAt]),
    ).toEqual([
      ["command-one", new Date(1000).toISOString(), new Date(2000).toISOString()],
      ["command-two", new Date(3000).toISOString(), undefined],
    ]);
  },
);

test("retires a failed acceptance after a later save commits the original sending row", () => {
  save({ status: "active", value: "packing" });
  history.commandSending(command);
  at = 2000;
  const db = store.connection.database;
  db.exec(
    "CREATE TRIGGER reject_acceptance BEFORE UPDATE ON history_command BEGIN SELECT RAISE(FAIL,'acceptance fault'); END",
  );
  history.commandAccepted({ ...command, sequence: 3 });
  expect(logs).toHaveLength(1);
  db.exec("DROP TRIGGER reject_acceptance");
  save({ status: "active", value: "ready" });
  db.exec(
    "CREATE TRIGGER reject_command BEFORE INSERT ON history_command BEGIN SELECT RAISE(FAIL,'unnecessary rewrite'); END",
  );
  expect(() => save({ status: "active", value: "ready" })).not.toThrow();
  expect(history.read("parcel")!.commands[0]).toMatchObject({
    sentAt: new Date(1000).toISOString(),
    acceptedAt: new Date(2000).toISOString(),
  });
});

test("canonical parallel values continue one visit, and a stopped actor closes it", () => {
  save({ status: "active", value: { packing: { left: "ready", right: "waiting" } } });
  at = 2000;
  save({ status: "active", value: { packing: { right: "waiting", left: "ready" } } });
  expect(history.read("parcel")!.visits).toHaveLength(1);
  save({ status: "stopped", value: { packing: { left: "ready", right: "waiting" } } });
  expect(history.read("parcel")).toMatchObject({
    actor: { status: "stopped" },
    end: { status: "stopped", endedAt: new Date(2000).toISOString() },
    visits: [
      {
        states: ["packing.left.ready", "packing.right.waiting"],
        enteredAt: new Date(1000).toISOString(),
        exitedAt: new Date(2000).toISOString(),
      },
    ],
  });
});

test("a failed command write blocks only the actor that sent it", () => {
  save({ status: "active", value: "packing" });
  const db = store.connection.database;
  db.exec(
    "CREATE TRIGGER reject_command BEFORE INSERT ON history_command BEGIN SELECT RAISE(FAIL,'fixture fault'); END",
  );
  history.commandSending({ ...command, invocation: { ...command.invocation, actorId: "other" } });
  expect(() => save({ status: "active", value: "ready" })).not.toThrow();
  expect(history.read("other")!.commands).toEqual([]);
  db.exec("DROP TRIGGER reject_command");
  save({ status: "done", value: "delivered" }, { actorId: "other" });
  expect(history.read("other")!.commands).toHaveLength(1);
  expect(history.read("parcel")!.commands).toEqual([]);
});

test("visit readers share history numbering, blueprint boundaries and time ties", () => {
  expect(history.visits("unknown")).toEqual([]);
  expect(history.visitAt("unknown", 1000)).toBeUndefined();
  save({ status: "active", value: "waiting" });
  at = 2000;
  save(
    { status: "active", value: "waiting" },
    { machine: `${"b".repeat(40)}:blueprints/parcel.yml` },
  );
  save(
    { status: "active", value: "delivered" },
    { machine: `${"b".repeat(40)}:blueprints/parcel.yml` },
  );
  expect(history.visits("parcel")).toEqual(history.read("parcel")!.visits);
  expect([0, 1000, 1500, 2000, 3000].map((time) => history.visitAt("parcel", time))).toEqual([
    1, 1, 1, 3, 3,
  ]);
});
test.each([false, true])(
  "project commands keep identity and recover a failed write: %s",
  (fault) => {
    save({ status: "active", value: "creating" });
    const project = {
      implementation: "t3code-project-create" as const,
      commandId: "project-command",
      invocation: command.invocation,
      environment: "station",
      projectId: "project-one",
    };
    const db = store.connection.database;
    if (fault)
      db.exec(
        "CREATE TRIGGER reject_project BEFORE INSERT ON history_command BEGIN SELECT RAISE(FAIL,'fixture fault'); END",
      );
    history.commandSending(project);
    at = 2000;
    history.commandAccepted({ ...project, sequence: 3 });
    if (fault) {
      expect(logs).toHaveLength(2);
      expect(() => save({ status: "active", value: "waiting" })).toThrow("fixture fault");
      expect(history.read("parcel")!.visits).toHaveLength(1);
      db.exec("DROP TRIGGER reject_project");
      save({ status: "active", value: "waiting" });
    }
    history.commandSending(project);
    history.commandAccepted({ ...project, sequence: 4 });
    expect(history.read("parcel")!.commands).toEqual([
      {
        commandId: "project-command",
        kind: "project-create",
        environment: "station",
        projectId: "project-one",
        invokeId: "send",
        entryId: "1",
        sentAt: new Date(1000).toISOString(),
        acceptedAt: new Date(2000).toISOString(),
      },
    ]);
  },
);

test("command identities reject projects with threads and thread commands with projects", () => {
  const insert = store.connection.database.prepare(
    "INSERT INTO history_command (command_id,actor_id,kind,invoke_id,entry_id,environment,thread_id,project_id,sent_at) VALUES (?,'parcel',?,'create','one','station',?,?,1)",
  );
  insert.run("project", "project-create", null, "project-one");
  insert.run("thread", "thread-create", "thread-one", null);
  for (const [kind, thread, project] of [
    ["project-create", "thread-one", "project-one"],
    ["project-create", null, null],
    ["thread-create", "thread-one", "project-one"],
    ["turn-start", null, null],
    ["unknown", "thread-one", null],
  ] as const)
    expect(() => insert.run("invalid", kind, thread, project)).toThrow();
});

test.each([false, true])(
  "pruning retires pending commands only after the outer commit (rollback: %s)",
  (rollback) => {
    save({ status: "done", value: "delivered" });
    const db = store.connection.database;
    history.commandSending(command);
    db.exec(
      "CREATE TRIGGER reject_acceptance BEFORE UPDATE ON history_command BEGIN SELECT RAISE(FAIL,'fixture fault'); END",
    );
    db.exec(
      "CREATE TRIGGER reject_command BEFORE INSERT ON history_command BEGIN SELECT RAISE(FAIL,'fixture fault'); END",
    );
    history.commandAccepted({ ...command, sequence: 3 });
    history.commandSending({
      ...command,
      commandId: "other-command",
      invocation: { ...command.invocation, actorId: "other" },
    });
    expect(logs).toHaveLength(2);
    db.exec("DROP TRIGGER reject_command; DROP TRIGGER reject_acceptance");
    const prune = () =>
      store.connection.transaction(() => {
        history.prune("parcel");
        if (rollback) throw new Error("outer rollback");
      });
    if (rollback) expect(prune).toThrow("outer rollback");
    else prune();
    save({ status: "done", value: "delivered" });
    save({ status: "done", value: "delivered" }, { actorId: "other" });
    expect(history.read("parcel")!.commands.map((c) => c.commandId)).toEqual(
      rollback ? ["command-one"] : [],
    );
    if (rollback)
      expect(history.read("parcel")!.commands[0]!.acceptedAt).toBe(new Date(at).toISOString());
    expect(history.read("other")!.commands.map((c) => c.commandId)).toEqual(["other-command"]);
  },
);
