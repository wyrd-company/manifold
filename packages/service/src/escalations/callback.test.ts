// ---
// relationships:
//   verifies: escalations
// ---
import { createActor, createMachine, assign } from "xstate";
import { afterEach, expect, test } from "vite-plus/test";
import { fixture, request } from "./test-support.ts";
import type { PersistedSnapshot } from "../store/index.ts";
import { openEscalations } from "./index.ts";
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const clean of cleanups.splice(0).toReversed()) await clean();
});
test("callback answers once, save marks taken, restart in the same state sends nothing", async () => {
  const f = fixture({ invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }) });
  cleanups.push(f.close);
  const machine = createMachine({
    initial: "asking",
    context: { answers: 0 },
    states: {
      asking: {
        invoke: {
          id: "ask",
          src: f.module.escalate,
          input: { question: "Send it?", choices: [{ id: "send", label: "Send" }] },
        },
        on: {
          "escalation.answered": {
            actions: assign({ answers: ({ context }) => context.answers + 1 }),
          },
        },
      },
    },
  });
  const actor = createActor(machine).start();
  const escalation = f.module.list({})[0]!;
  f.module.answer(escalation.id, { choice: "send" }, "api");
  expect(actor.getSnapshot().context.answers).toBe(1);
  f.store.connection.transaction(() => {
    f.store.saveSnapshot({
      actorId: "parcel",
      machine: "parcel",
      snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
    });
    f.module.saving({
      actorId: "parcel",
      snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
      activeInvokes: [{ invokeId: "ask", entryId: "1" }],
    });
  });
  const snapshot = actor.getPersistedSnapshot();
  actor.stop();
  await f.module.stop();
  const resumed = openEscalations({
    store: f.store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: { "held-actor": () => {}, "stranded-token": () => {} },
    invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }),
  });
  cleanups.push(() => resumed.stop());
  const nextMachine = createMachine({
    initial: "asking",
    context: { answers: 0 },
    states: {
      asking: {
        invoke: {
          id: "ask",
          src: resumed.escalate,
          input: { question: "Send it?", choices: [{ id: "send", label: "Send" }] },
        },
        on: {
          "escalation.answered": {
            actions: assign({ answers: ({ context }) => context.answers + 1 }),
          },
        },
      },
    },
  });
  const next = createActor(nextMachine, { snapshot }).start();
  expect(next.getSnapshot().context.answers).toBe(1);
  next.stop();
});
test("unsaved answers replay, stopping callbacks leaves open questions, saved exit withdraws", () => {
  const f = fixture({ invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }) });
  cleanups.push(f.close);
  const machine = createMachine({
    initial: "asking",
    context: { answers: 0 },
    states: {
      asking: {
        invoke: { src: f.module.escalate, input: { question: "Send it?", freeText: true } },
        on: {
          "escalation.answered": {
            actions: assign({ answers: ({ context }) => context.answers + 1 }),
          },
          leave: "later",
        },
      },
      later: {},
    },
  });
  const actor = createActor(machine).start();
  const escalation = f.module.list({})[0]!;
  const snapshot = actor.getPersistedSnapshot();
  actor.stop();
  expect(f.module.get(escalation.id)?.status).toBe("open");
  const restored = createActor(machine, { snapshot }).start();
  f.module.answer(escalation.id, { text: "Proceed" }, "api");
  expect(restored.getSnapshot().context.answers).toBe(1);
  restored.stop();
  const replay = createActor(machine, { snapshot }).start();
  expect(replay.getSnapshot().context.answers).toBe(1);
  replay.stop();
});
test("saved exit refuses an answer and no later state receives it; failed save withdraws nothing", () => {
  const f = fixture({ invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }) });
  cleanups.push(f.close);
  const machine = createMachine({
    initial: "asking",
    context: { answers: 0 },
    states: {
      asking: {
        invoke: { src: f.module.escalate, input: { question: "Send it?", freeText: true } },
        on: { leave: "later" },
      },
      later: {
        on: {
          "escalation.answered": {
            actions: assign({ answers: ({ context }) => context.answers + 1 }),
          },
        },
      },
    },
  });
  const actor = createActor(machine).start();
  const escalation = f.module.list({})[0]!;
  actor.send({ type: "leave" });
  expect(() =>
    f.store.connection.transaction(() => {
      f.module.saving({
        actorId: "parcel",
        snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
        activeInvokes: [],
      });
      throw new Error("rollback");
    }),
  ).toThrow("rollback");
  expect(f.module.get(escalation.id)?.status).toBe("open");
  f.module.saving({
    actorId: "parcel",
    snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
    activeInvokes: [],
  });
  expect(f.module.answer(escalation.id, { text: "Proceed" }, "api").status).toBe("closed");
  expect(actor.getSnapshot().context.answers).toBe(0);
  actor.stop();
});
test.each([
  { question: "", freeText: true },
  {
    question: "Question",
    choices: [
      { id: "same", label: "First" },
      { id: "same", label: "Second" },
    ],
  },
  { question: "Question" },
  {
    question: "Question",
    choices: Array.from({ length: 4 }, (_, index) => ({
      id: "option-" + String(index),
      label: "Option",
    })),
  },
])("invalid input errors at the callback boundary: %j", (input) => {
  const f = fixture({ invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }) });
  cleanups.push(f.close);
  const actor = createActor(
    createMachine({
      initial: "asking",
      states: {
        asking: { invoke: { src: f.module.escalate, input, onError: "invalid" } },
        invalid: { type: "final" },
      },
    }),
  ).start();
  expect(actor.getSnapshot().value).toBe("invalid");
  expect(f.module.list({})).toEqual([]);
  actor.stop();
});
test("unknown destinations fail only their notification and service withdrawal is idempotent", () => {
  const f = fixture({ invocationOf: () => ({ actorId: "parcel", invokeId: "ask", entryId: "1" }) });
  cleanups.push(f.close);
  const actor = createActor(
    createMachine({
      initial: "asking",
      states: {
        asking: {
          invoke: {
            src: f.module.escalate,
            input: { question: "Send it?", freeText: true, destinations: ["missing"] },
          },
        },
      },
    }),
  ).start();
  expect(f.module.list({})[0]?.status).toBe("open");
  expect(f.warnings).toContain("Notification destination missing: unknown destination");
  const escalation = f.module.raise(request);
  f.module.withdraw(request);
  f.module.withdraw(request);
  expect(f.module.get(escalation.id)?.status).toBe("withdrawn");
  actor.stop();
});
