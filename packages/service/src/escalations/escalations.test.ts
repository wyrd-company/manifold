// ---
// relationships:
//   verifies: escalations
// ---
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { openEscalations, heldActorHandler } from "./index.ts";

const cleanup: (() => void)[] = [];
afterEach(async () => {
  for (const clean of cleanup.splice(0).toReversed()) await clean();
});
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "questions-"));
  const store = openStore({ path: join(directory, "store.sqlite") });
  cleanup.push(
    () => rmSync(directory, { recursive: true, force: true }),
    () => store.close(),
  );
  const releases: string[] = [];
  const module = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "intake-failed": () => {},
      "comparator-failed": () => {},
      "held-actor": heldActorHandler((id) => releases.push(id)),
      "stranded-token": () => {},
    },
  });
  cleanup.push(() => {
    void module.stop();
  });
  return { store, module, releases };
}
const request = {
  kind: "held-actor" as const,
  subject: { actorId: "parcel" },
  question: "Try the delivery again?",
  choices: [
    { id: "retry", label: "Retry" },
    { id: "dismiss", label: "Dismiss" },
  ],
};
test("a repeated cause converges; first answer wins and retry can raise a new occurrence", () => {
  const { module, releases } = fixture();
  const first = module.raise(request);
  expect(module.raise(request).id).toBe(first.id);
  expect(module.answer(first.id, { choice: "missing" }, "api").status).toBe("invalid");
  expect(module.answer(first.id, { choice: "retry" }, "api").status).toBe("answered");
  expect(module.answer(first.id, { choice: "dismiss" }, "link")).toMatchObject({
    status: "closed",
    escalation: { answer: { value: { choice: "retry" } } },
  });
  expect(releases).toEqual(["parcel"]);
  expect(module.raise(request)).toMatchObject({ status: "open", raiser: { occurrence: 2 } });
});
test("withdrawal joins the save transaction and error saves leave a held cause open", () => {
  const { module, store } = fixture();
  const first = module.raise(request);
  module.saving({
    machine: "delivery",
    entered: [],
    entries: {},
    actorId: "parcel",
    snapshot: { status: "error" },
    activeInvokes: [],
  });
  expect(module.get(first.id)?.status).toBe("open");
  expect(() =>
    store.connection.transaction(() => {
      module.saving({
        machine: "delivery",
        entered: [],
        entries: {},
        actorId: "parcel",
        snapshot: { status: "active", value: "waiting" },
        activeInvokes: [],
      });
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(module.get(first.id)?.status).toBe("open");
  module.saving({
    machine: "delivery",
    entered: [],
    entries: {},
    actorId: "parcel",
    snapshot: { status: "done", value: "delivered" },
    activeInvokes: [],
  });
  expect(module.answer(first.id, { choice: "retry" }, "api").status).toBe("closed");
});
test("service handlers write atomically and run their returned work after commit", () => {
  const { store } = fixture();
  let rolledBack = false;
  let after = false;
  const module = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "intake-failed": () => {},
      "comparator-failed": () => {},
      "held-actor": () => {
        store.connection.database.exec("CREATE TABLE handler_result(value TEXT)");
        return () => {
          after = true;
          expect(store.connection.database.isTransaction).toBe(false);
        };
      },
      "stranded-token": () => {
        rolledBack = true;
      },
    },
  });
  cleanup.push(() => {
    void module.stop();
  });
  const escalation = module.raise(request);
  module.answer(escalation.id, { choice: "retry" }, "api");
  expect(after).toBe(true);
  expect(rolledBack).toBe(false);
});

test("an answered cause with failed handling keeps its occurrence and retries on start", () => {
  const { store } = fixture();
  let fail = true;
  let calls = 0;
  let after = 0;
  const module = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "intake-failed": () => {},
      "comparator-failed": () => {},
      "held-actor": () => {
        calls++;
        store.connection.database.exec("CREATE TABLE handler_write(value TEXT)");
        if (fail) throw new Error("handler failed");
        return () => {
          after++;
        };
      },
      "stranded-token": () => {},
    },
  });
  cleanup.push(() => {
    void module.stop();
  });
  const first = module.raise(request);
  expect(() => module.answer(first.id, { choice: "retry" }, "api")).toThrow("handler failed");
  expect(module.raise(request).id).toBe(first.id);
  expect(module.get(first.id)?.status).toBe("answered");
  expect(
    store.connection.database
      .prepare("SELECT name FROM sqlite_master WHERE name='handler_write'")
      .get(),
  ).toBeUndefined();
  fail = false;
  module.start();
  module.start();
  expect(calls).toBe(2);
  expect(after).toBe(1);
  expect(module.raise(request).raiser).toMatchObject({ occurrence: 2 });
});

test("agent questions accept title and free text and roll back with their caller", () => {
  const { module, store } = fixture();
  const question = {
    kind: "agent-question" as const,
    subject: { actorId: "parcel", callId: "question-call" },
    title: "Delivery address",
    question: "Where should the parcel go?",
    choices: [],
    freeText: true,
  };
  expect(() =>
    store.connection.transaction(() => {
      module.raise(question);
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(module.list({})).toEqual([]);
  const raised = module.raise(question);
  expect(raised).toMatchObject({ title: question.title, freeText: true });
  expect(module.raise(question).id).toBe(raised.id);
  expect(module.answer(raised.id, { text: "Front desk" }, "api").status).toBe("answered");
});

test("upgrades populated escalations without losing answers, notifications or sequence", () => {
  const directory = mkdtempSync(join(tmpdir(), "questions-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "store.sqlite");
  const old = openStore({ path });
  old.connection.migrate("escalation", [
    readFileSync(new URL("./test-fixtures/legacy-schema.sql", import.meta.url), "utf8"),
  ]);
  const id = "a".repeat(22);
  old.connection.database
    .prepare(
      `INSERT INTO escalation(escalation_id,kind,subject,occurrence,title,question,choices,free_text,destinations,key_digest,status,answer,channel,raised_at,closed_at,handled_at) VALUES(?, 'held-actor', '{"actorId":"parcel"}', 1, 'Delivery', 'Retry?', '[]', 1, '["default"]', ?, 'answered', '{"text":"Front desk"}', 'api', 1, 2, 2)`,
    )
    .run(id, Buffer.alloc(32, 1));
  old.connection.database
    .prepare(
      `INSERT INTO escalation_notification(notification_id,escalation_id,destination,purpose,message,status,attempts,next_attempt_at,created_at,settled_at) VALUES(9,?,'default','ask',NULL,'sent',1,1,1,2)`,
    )
    .run(id);
  old.connection.database
    .prepare(
      `INSERT INTO escalation_notification(notification_id,escalation_id,destination,purpose,message,status,attempts,next_attempt_at,created_at,settled_at) VALUES(20,?,'default','close',NULL,'sent',1,1,1,2)`,
    )
    .run(id);
  old.connection.database.exec("DELETE FROM escalation_notification WHERE notification_id=20");
  const previous = old.connection.database.prepare("SELECT * FROM escalation").get();
  const notifications = old.connection.database
    .prepare("SELECT * FROM escalation_notification")
    .all();
  old.close();
  const store = openStore({ path });
  cleanup.push(() => store.close());
  const module = openEscalations({
    store,
    configuration: {
      destinations: {
        default: {
          server: "https://example.test",
          topic: "opaque-topic",
          posture: "open",
          priority: 4,
        },
      },
      publicUrl: "https://example.test",
      requestTimeoutMs: 30000,
      retryIntervalMs: 60000,
    },
    tokenFile: () => "",
    handlers: {},
  });
  cleanup.push(() => {
    void module.stop();
  });
  expect(store.connection.database.prepare("SELECT * FROM escalation").get()).toEqual(previous);
  expect(store.connection.database.prepare("SELECT * FROM escalation_notification").all()).toEqual(
    notifications,
  );
  expect(module.get(id)).toMatchObject({
    status: "answered",
    answer: { value: { text: "Front desk" } },
  });
  expect(
    store.connection.database
      .prepare("SELECT * FROM escalation_notification WHERE notification_id=9")
      .get(),
  ).toMatchObject({ escalation_id: id, status: "sent", attempts: 1 });
  const raised = module.raise({
    kind: "agent-question",
    subject: { actorId: "parcel", callId: "question-call" },
    title: "Address",
    question: "Where?",
    choices: [],
    freeText: true,
  });
  expect(raised.raiser).toMatchObject({ kind: "agent-question" });
  expect(
    store.connection.database
      .prepare("SELECT notification_id FROM escalation_notification WHERE escalation_id=?")
      .get(raised.id)?.["notification_id"],
  ).toBe(21);
  expect(store.connection.database.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  expect(
    store.connection.database
      .prepare("SELECT version FROM schema_migration WHERE owner='escalation'")
      .get()?.["version"],
  ).toBe(2);
});
