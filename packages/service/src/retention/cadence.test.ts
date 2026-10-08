// ---
// relationships:
//   verifies: retention
// ---
import { expect, test } from "vite-plus/test";
import { openRetention } from "./index.ts";
import type { RetentionClock } from "./index.ts";
import { world, day } from "./test-fixtures/world.ts";
function manual(now: () => number) {
  let timer: { delay: number; wake: () => void } | undefined;
  const yields: (() => void)[] = [];
  const clock: RetentionClock = {
    now,
    setTimer(delay, wake) {
      const current = { delay, wake };
      timer = current;
      return () => {
        if (timer === current) timer = undefined;
      };
    },
    yield(next) {
      yields.push(next);
    },
  };
  return {
    clock,
    delay: () => timer?.delay,
    wake: () => {
      const wake = timer!.wake;
      timer = undefined;
      wake();
    },
    next: () => yields.shift()?.(),
    waiting: () => yields.length,
  };
}
test("cadence starts after five minutes, joins a pass, and rearms an hour after completion", async () => {
  const w = await world();
  try {
    w.save("parcel");
    w.time(100 * day);
    const c = manual(w.now),
      logs: { event: string }[] = [];
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: c.clock,
      log: (entry) => logs.push(entry),
    });
    r.start();
    r.start();
    expect(c.delay()).toBe(5 * 60 * 1000);
    c.wake();
    const pass = r.prune();
    expect(r.prune()).toBe(pass);
    await Promise.resolve();
    expect(c.waiting()).toBe(1);
    expect(c.delay()).toBeUndefined();
    c.next();
    expect((await pass).actors).toBe(1);
    expect(logs.map((l) => l.event)).toEqual(["retention-pruned"]);
    expect(c.delay()).toBe(60 * 60 * 1000);
    await r.stop();
    expect(c.delay()).toBeUndefined();
    expect(await r.prune()).toEqual({
      actors: 0,
      inboxRows: 0,
      historyRows: 0,
      sourceEvents: 0,
      gateEvaluations: 0,
    });
  } finally {
    await w.close();
  }
});
test("stop waits for the next batch boundary and keeps later candidates", async () => {
  const w = await world();
  try {
    for (let n = 0; n < 101; n++) w.save(`parcel-${String(n).padStart(3, "0")}`);
    w.time(100 * day);
    const c = manual(w.now);
    const r = openRetention({
      ...w,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: c.clock,
      log: () => {},
    });
    const pass = r.prune();
    await Promise.resolve();
    const stop = r.stop();
    expect(w.history.read("parcel-100")?.prunedAt).toBeUndefined();
    c.next();
    for (let n = 0; n < 10; n++) {
      await Promise.resolve();
      c.next();
    }
    await stop;
    expect((await pass).actors).toBe(100);
    expect(w.history.read("parcel-100")?.commands).toHaveLength(1);
  } finally {
    await w.close();
  }
});
test("a failed batch rolls back the actor and schedules the next pass", async () => {
  const w = await world();
  try {
    w.save("parcel");
    w.time(100 * day);
    const c = manual(w.now),
      logs: { event: string }[] = [];
    const r = openRetention({
      ...w,
      history: {
        prune: () => {
          throw new Error("write failed");
        },
      },
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: c.clock,
      log: (entry) => logs.push(entry),
    });
    r.start();
    await expect(r.prune()).rejects.toThrow("write failed");
    expect(w.history.read("parcel")?.prunedAt).toBeUndefined();
    expect(w.history.read("parcel")?.events).toHaveLength(1);
    expect(w.history.read("parcel")?.commands).toHaveLength(1);
    expect(logs.map((l) => l.event)).toEqual(["retention-failed"]);
    expect(c.delay()).toBe(60 * 60 * 1000);
    await r.stop();
  } finally {
    await w.close();
  }
});

test.each(["sources", "evaluations"] as const)(
  "stop during %s pruning keeps the next batch",
  async (kind) => {
    const w = await world();
    try {
      for (let n = 0; n < 1001; n++) {
        if (kind === "sources")
          w.router.publish({
            source: "weather",
            eventId: `scan-${n}`,
            topics: ["weather.station"],
            event: { type: "scan" },
          });
        else w.evaluation();
      }
      w.time(100 * day);
      const c = manual(w.now);
      const r = openRetention({
        ...w,
        configuration: {
          historyDays: "forever",
          sourceEventDays: { default: 30 },
          gateEvaluationDays: 30,
        },
        clock: c.clock,
        log: () => {},
      });
      const pass = r.prune();
      await Promise.resolve();
      const stop = r.stop();
      c.next();
      for (let n = 0; n < 10; n++) {
        await Promise.resolve();
        c.next();
      }
      await stop;
      expect(await pass).toMatchObject(
        kind === "sources" ? { sourceEvents: 1000, gateEvaluations: 0 } : { gateEvaluations: 1000 },
      );
      const table = kind === "sources" ? "router_source_event" : "gates_evaluation";
      expect(
        w.store.connection.database.prepare(`SELECT count(*) n FROM ${table}`).get()?.["n"],
      ).toBe(1);
    } finally {
      await w.close();
    }
  },
);

test("an automatically scheduled failed pass consumes its rejection and rearms", async () => {
  const w = await world();
  try {
    w.save("parcel");
    w.time(100 * day);
    const c = manual(w.now),
      logs: { event: string }[] = [];
    const r = openRetention({
      ...w,
      history: {
        prune: () => {
          throw new Error("write failed");
        },
      },
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: c.clock,
      log: (entry) => logs.push(entry),
    });
    r.start();
    c.wake();
    await expect.poll(() => logs.map((l) => l.event)).toEqual(["retention-failed"]);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(c.delay()).toBe(60 * 60 * 1000);
    await r.stop();
  } finally {
    await w.close();
  }
});
