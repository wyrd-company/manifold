// ---
// relationships:
//   verifies: escalations
// ---
import { mkdtempSync, rmSync } from "node:fs";
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
  module.saving({ actorId: "parcel", snapshot: { status: "error" }, activeInvokes: [] });
  expect(module.get(first.id)?.status).toBe("open");
  expect(() =>
    store.connection.transaction(() => {
      module.saving({
        actorId: "parcel",
        snapshot: { status: "active", value: "waiting" },
        activeInvokes: [],
      });
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(module.get(first.id)?.status).toBe("open");
  module.saving({
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
