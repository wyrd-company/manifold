// ---
// relationships:
//   verifies: retention
// ---
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { openHistory } from "../history/index.ts";
import { openEscalations } from "../escalations/index.ts";
import { startRouter } from "../router/index.ts";
import { openRetention } from "./index.ts";

test("prunes ended actors atomically, keeps visits and pending rows, and converges", async () => {
  let at = 1;
  const store = openStore({ path: ":memory:", now: () => at });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: () => ({ status: "held", reason: "fixture" }),
    },
  });
  const escalations = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    handlers: {},
    tokenFile: () => "",
  });
  const history = openHistory({ store, now: () => at, log: () => {} });
  try {
    for (const actorId of ["parcel", "active", "recent", "protected"]) {
      at = 1;
      const write = {
        actorId,
        machine: "delivery",
        snapshot: { status: "active" as const, value: "waiting" },
        activeInvokes: [],
        entered: [],
        entries: {},
      };
      store.saveSnapshot(write);
      history.saveHook(write);
      store.writeInbox(
        {
          eventId: "scan",
          topic: "weather.station",
          payload: { type: "scan", data: "large payload" },
        },
        [actorId],
      );
      store.markConsumed(actorId, "scan");
      history.saveHook({ ...write, eventId: "scan", changedBy: { type: "scan", eventId: "scan" } });
      store.writeInbox(
        { eventId: "pending", topic: "weather.station", payload: { type: "scan" } },
        [actorId],
      );
      history.commandSending({
        implementation: "turn-start",
        commandId: actorId,
        invocation: { actorId, invokeId: "send", entryId: "1" },
        environment: "station",
        threadId: "thread",
        messageId: "message",
      });
      if (actorId !== "active") {
        at = actorId === "recent" ? 100 * 86400000 : 1;
        const ended = {
          ...write,
          snapshot: { status: "done" as const, value: "delivered", output: "received" },
        };
        store.saveSnapshot(ended);
        history.saveHook(ended);
      }
    }
    at = 100 * 86400000;
    const before = history.read("active");
    const visits = history.read("parcel")!.visits;
    escalations.raise({
      kind: "held-actor",
      subject: { actorId: "protected" },
      question: "Continue delivery?",
      choices: [{ id: "continue", label: "Continue" }],
    });
    const retention = openRetention({
      store,
      history,
      escalations,
      configuration: {
        historyDays: 90,
        sourceEventDays: { default: "forever" },
        gateEvaluationDays: "forever",
      },
      clock: { now: () => at, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: () => {},
    });
    expect(await retention.prune()).toEqual({
      actors: 1,
      inboxRows: 1,
      historyRows: 2,
      sourceEvents: 0,
      gateEvaluations: 0,
    });
    const pruned = history.read("parcel")!;
    expect(pruned.visits).toEqual(visits);
    expect(pruned.events.map((e) => e.eventId)).toEqual(["pending"]);
    expect(pruned.commands).toEqual([]);
    expect(pruned.prunedAt).toBe(new Date(at).toISOString());
    expect(pruned.end?.output).toBe("received");
    expect(history.read("active")).toEqual(before);
    expect(history.read("protected")!.commands).toHaveLength(1);
    expect(store.endedSnapshots().map((s) => s.actorId)).toContain("parcel");
    expect(await retention.prune()).toEqual({
      actors: 0,
      inboxRows: 0,
      historyRows: 0,
      sourceEvents: 0,
      gateEvaluations: 0,
    });
    await retention.stop();
  } finally {
    router.stop();
    await escalations.stop();
    store.close();
  }
});

test("store pagination, active protection, and rollback use the public boundary", () => {
  const store = openStore({ path: ":memory:", now: () => 10 });
  try {
    for (const actorId of ["a", "b", "c"])
      store.saveSnapshot({
        actorId,
        machine: "delivery",
        snapshot: { status: actorId === "c" ? "active" : "done", value: "waiting" },
      });
    store.writeInbox({ eventId: "scan", topic: "weather.station", payload: {} }, ["a"]);
    store.markConsumed("a", "scan");
    const first = store.prunableEnded({ endedBefore: 11, limit: 1 });
    expect(first).toEqual([{ actorId: "a", savedAt: 10 }]);
    expect(store.prunableEnded({ endedBefore: 11, after: first[0]!, limit: 1 })).toEqual([
      { actorId: "b", savedAt: 10 },
    ]);
    expect(store.prunableEnded({ endedBefore: 10, limit: 10 })).toEqual([]);
    expect(store.pruneEnded("c")).toEqual({ status: "unchanged" });
    expect(() =>
      store.connection.transaction(() => {
        store.pruneEnded("a");
        throw new Error("rollback");
      }),
    ).toThrow("rollback");
    expect(store.actorInbox("a")).toHaveLength(1);
    expect(store.loadSnapshot("a")!.historyPrunedAt).toBeUndefined();
    expect(store.pruneEnded("a")).toEqual({ status: "pruned", inboxRows: 1 });
    expect(store.pruneEnded("a")).toEqual({ status: "unchanged" });
  } finally {
    store.close();
  }
});
