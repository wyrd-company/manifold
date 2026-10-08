// ---
// relationships:
//   verifies: retention
// ---
import { createActor } from "xstate";
import { expect, test } from "vite-plus/test";
import { openRetention } from "./index.ts";
import { day, world } from "./test-fixtures/world.ts";
import type { RetentionClock } from "./index.ts";
const clock = (now: () => number, onYield = () => {}): RetentionClock => ({
  now,
  setTimer: () => () => {},
  yield(next) {
    onYield();
    setImmediate(next);
  },
});
test("source windows preserve duplicates inside the window and inbox deduplication outside it", async () => {
  const w = await world();
  try {
    const event = (source: string, eventId: string) => ({
      source,
      eventId,
      topics: [`${source}.station`],
      event: { type: "scan" },
    });
    w.time(1);
    expect(w.router.publish(event("weather", "old"))).toMatchObject({ replay: false });
    expect(w.router.publish(event("traffic", "kept"))).toMatchObject({ replay: false });
    w.time(80 * day);
    expect(w.router.publish(event("weather", "inside"))).toMatchObject({ replay: false });
    const write = {
      actorId: "parcel",
      machine: "delivery",
      snapshot: { status: "active" as const, value: "waiting" },
    };
    w.store.saveSnapshot(write);
    w.router.attach({
      actorId: "parcel",
      send: () => {},
      persist: () => ({ machine: write.machine, snapshot: write.snapshot }),
    });
    w.store.writeInbox(
      { eventId: "weather:old", topic: "weather.station", payload: { type: "scan" } },
      ["parcel"],
    );
    w.store.markConsumed("parcel", "weather:old");
    w.time(100 * day);
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: "forever",
        sourceEventDays: { default: 30, traffic: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: clock(w.now),
      log: () => {},
    });
    expect((await r.prune()).sourceEvents).toBe(1);
    expect(w.router.publish(event("weather", "inside"))).toMatchObject({ replay: true });
    expect(w.router.publish(event("traffic", "kept"))).toMatchObject({ replay: true });
    expect(w.router.publish(event("weather", "old"))).toMatchObject({ replay: false, rows: [] });
    expect((await r.prune()).sourceEvents).toBe(0);
    await r.stop();
  } finally {
    await w.close();
  }
});
test("gate pruning preserves held tokens and open escalations, clears returned references and keeps replay", async () => {
  const w = await world();
  try {
    const old = w.evaluation(),
      held = w.evaluation(),
      returned = w.evaluation(),
      protectedId = w.evaluation("protected#waiting");
    w.token(held, 1);
    w.token(returned, 2, true);
    expect(() =>
      w.store.connection.database
        .prepare("DELETE FROM gates_evaluation WHERE evaluation_id=?")
        .run(held),
    ).toThrow();
    w.escalations.raise({
      kind: "comparator-failed",
      subject: { gate: "protected#waiting" },
      question: "Retry sorting?",
      choices: [{ id: "retry", label: "Retry" }],
    });
    w.time(80 * day);
    const inside = w.evaluation();
    w.time(100 * day);
    const replay = await w.gates.replay(inside);
    expect(replay.recorded).toMatchObject({ ok: true, selection: null });
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: "forever",
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: 30,
      },
      clock: clock(w.now),
      log: () => {},
    });
    expect((await r.prune()).gateEvaluations).toBe(2);
    await expect(w.gates.replay(old)).rejects.toThrow("Unknown evaluation id");
    expect((await w.gates.replay(inside)).recorded).toEqual(replay.recorded);
    expect((await w.gates.replay(held)).recorded).toMatchObject({ ok: true });
    expect(
      w.store.connection.database
        .prepare("SELECT evaluation_id FROM gates_token WHERE token_id='token:2'")
        .get()?.["evaluation_id"],
    ).toBeNull();
    expect(
      w.store.connection.database
        .prepare("SELECT evaluation_id FROM gates_evaluation WHERE evaluation_id=?")
        .get(protectedId),
    ).toBeDefined();
    expect((await r.prune()).gateEvaluations).toBe(0);
    w.escalations.withdraw({ kind: "comparator-failed", subject: { gate: "protected#waiting" } });
    expect((await r.prune()).gateEvaluations).toBe(1);
    await r.stop();
  } finally {
    await w.close();
  }
});
test("an escalation opened between actor batches protects the later actor and gate", async () => {
  const w = await world();
  try {
    for (let n = 0; n < 101; n++) w.save(`parcel-${String(n).padStart(3, "0")}`);
    const evaluation = w.evaluation("sorting#waiting");
    w.time(100 * day);
    let yields = 0;
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: 30,
      },
      clock: clock(w.now, () => {
        if (++yields === 1)
          w.escalations.raise({
            kind: "stranded-token",
            subject: { actorId: "parcel-100", gate: "sorting#waiting" },
            question: "Continue delivery?",
            choices: [{ id: "continue", label: "Continue" }],
          });
      }),
      log: () => {},
    });
    expect(await r.prune()).toMatchObject({ actors: 100, gateEvaluations: 0 });
    expect(w.history.read("parcel-100")!.commands).toHaveLength(1);
    expect(w.history.read("parcel-100")!.events).toHaveLength(1);
    expect(
      w.store.connection.database
        .prepare("SELECT 1 FROM gates_evaluation WHERE evaluation_id=?")
        .get(evaluation),
    ).toBeDefined();
    w.escalations.withdraw({
      kind: "stranded-token",
      subject: { actorId: "parcel-100", gate: "sorting#waiting" },
    });
    expect(await r.prune()).toMatchObject({ actors: 1, gateEvaluations: 1 });
    await r.stop();
  } finally {
    await w.close();
  }
});
test("forever keeps populated history, source events, and evaluations", async () => {
  const w = await world();
  try {
    w.save("parcel");
    w.evaluation();
    w.router.publish({
      source: "weather",
      eventId: "old",
      topics: ["weather.station"],
      event: { type: "scan" },
    });
    w.time(1000 * day);
    const before = w.history.read("parcel");
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: "forever",
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: clock(w.now),
      log: () => {},
    });
    expect(await r.prune()).toEqual({
      actors: 0,
      inboxRows: 0,
      historyRows: 0,
      sourceEvents: 0,
      gateEvaluations: 0,
    });
    expect(w.history.read("parcel")).toEqual(before);
    expect(
      w.store.connection.database.prepare("SELECT count(*) n FROM gates_evaluation").get()?.["n"],
    ).toBe(1);
    await r.stop();
  } finally {
    await w.close();
  }
});

test("bounded source and evaluation batches use one pass cutoff and keep open reservations", async () => {
  const w = await world();
  try {
    for (let n = 0; n < 1001; n++) {
      w.router.publish({
        source: "weather",
        eventId: `old-${n}`,
        topics: ["weather.station"],
        event: { type: "scan" },
      });
      w.evaluation();
    }
    const held = w.evaluation();
    w.token(held, 1);
    w.ledger.credit({
      key: "credit",
      account: "account",
      window: "window",
      opensAt: 0,
      closesAt: 200 * day,
      amount: 100,
    });
    w.ledger.reserve({
      key: "token:1",
      actor: "holder-1",
      item: "deliveries",
      account: "account",
      amount: 10,
    });
    const reserved = w.ledger.actorUsage("holder-1");
    w.time(70 * day);
    const boundary = w.evaluation();
    w.router.publish({
      source: "weather",
      eventId: "boundary",
      topics: ["weather.station"],
      event: { type: "scan" },
    });
    w.time(100 * day);
    let yields = 0;
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: "forever",
        sourceEventDays: { default: 30 },
        gateEvaluationDays: 30,
      },
      clock: clock(w.now, () => {
        yields++;
        w.time(101 * day);
      }),
      log: () => {},
    });
    expect(await r.prune()).toMatchObject({ sourceEvents: 1001, gateEvaluations: 1001 });
    expect(yields).toBe(4);
    expect(w.ledger.actorUsage("holder-1")).toEqual(reserved);
    expect(
      w.store.connection.database
        .prepare("SELECT 1 FROM gates_evaluation WHERE evaluation_id=?")
        .get(boundary),
    ).toBeDefined();
    expect(await r.prune()).toMatchObject({ sourceEvents: 1, gateEvaluations: 1 });
    await r.stop();
  } finally {
    await w.close();
  }
});

test("a blueprint escalation keeps its raiser's events and commands until answered", async () => {
  const w = await world();
  const callback = createActor(w.escalations.escalate, {
    input: { question: "Continue delivery?", choices: [{ id: "continue", label: "Continue" }] },
  });
  try {
    w.save("parcel");
    callback.start();
    w.time(100 * day);
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: clock(w.now),
      log: () => {},
    });
    expect((await r.prune()).actors).toBe(0);
    expect(w.history.read("parcel")?.commands).toHaveLength(1);
    const escalation = w.escalations.list({ status: "open" })[0]!;
    expect(escalation.raiser.type).toBe("blueprint");
    expect(w.escalations.answer(escalation.id, { choice: "continue" }, "api").status).toBe(
      "answered",
    );
    expect((await r.prune()).actors).toBe(1);
    await r.stop();
  } finally {
    callback.stop();
    await w.close();
  }
});
