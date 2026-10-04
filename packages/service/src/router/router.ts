// ---
// relationships:
//   implements: durable-event-delivery
//   references: router-events
// ---
import type { DeliveryTarget, InboxRow, SnapshotWrite } from "../store/index.ts";
import { deadlineLoop, systemClock } from "./deadline-loop.ts";
import { routerSteps } from "./migrations.ts";
import { subscriptionIndex } from "./topics.ts";
import type { Router, RouterOptions } from "./types.ts";
import { validateSourceEvent } from "./validate.ts";

export class ActorNotLoadedError extends TypeError {
  constructor(actorId: string) {
    super(`Actor ${actorId} is not loaded`);
  }
}

export function startRouter({
  store,
  host,
  clock = systemClock,
  afterDrain,
  onHeld,
}: RouterOptions): Router {
  store.connection.migrate("router", routerSteps);
  const accept = store.connection.database.prepare(
    "INSERT INTO router_source_event (source, event_id, accepted_at) VALUES (?, ?, ?) ON CONFLICT (source, event_id) DO NOTHING",
  );
  const index = subscriptionIndex();
  const targets = new Map<string, DeliveryTarget>();
  const scheduled = new Set<string>();
  const delivering = new Set<string>();
  let immediate: ReturnType<typeof setImmediate> | undefined;
  let stopped = false;
  let resuming = true;
  const deadlines = deadlineLoop(store, clock, schedule);

  function requireRunning() {
    if (stopped) throw new TypeError("Router is stopped");
  }
  function update(write: SnapshotWrite) {
    if (write.snapshot.status === "error") return;
    if (write.snapshot.status === "active") index.set(write.actorId, host.subscription(write));
    else {
      index.remove(write.actorId);
      if (store.pendingInbox(write.actorId).length === 0) targets.delete(write.actorId);
    }
  }
  function hold(actorId: string, reason: string, row?: InboxRow) {
    targets.delete(actorId);
    onHeld?.({ actorId, reason, row });
  }
  function schedule(actorId: string) {
    if (stopped || !targets.has(actorId)) return;
    scheduled.add(actorId);
    if (!resuming && immediate === undefined)
      immediate = setImmediate(() => {
        immediate = undefined;
        drainPass();
        if (!stopped) deadlines.arm();
      });
  }
  function drainPass() {
    const batch = [...scheduled];
    scheduled.clear();
    for (const actorId of batch) {
      const target = targets.get(actorId);
      if (stopped || !target) continue;
      delivering.add(actorId);
      let write: SnapshotWrite | undefined;
      try {
        const result = store.drain({
          actorId,
          send(row) {
            // A preceding row has committed before drain sends the next one.
            if (write) update(write);
            target.send(row);
          },
          saved(saved) {
            host.saving?.(saved);
          },
          persist() {
            const persisted = target.persist();
            write = { ...persisted, actorId };
            return persisted;
          },
        });
        if (result.erroredAt) hold(actorId, "Actor returned an errored snapshot", result.erroredAt);
        if (write) update(write);
      } finally {
        delivering.delete(actorId);
      }
    }
  }
  function save(write: SnapshotWrite) {
    return store.connection.transaction(() => {
      const outcome = store.saveSnapshot(write);
      if (outcome === "saved") host.saving?.(write);
      return outcome;
    });
  }
  const router: Router = {
    publish(event) {
      requireRunning();
      const issues = validateSourceEvent(event);
      if (issues.length) return { status: "rejected", issues };
      const outcome = store.connection.transaction(() => {
        if (accept.run(event.source, event.eventId, clock.now()).changes === 0)
          return { status: "accepted" as const, replay: true, rows: [] };
        const rows: InboxRow[] = [];
        for (const [topic, actors] of index.targets(event))
          rows.push(
            ...store.writeInbox(
              { eventId: `${event.source}:${event.eventId}`, topic, payload: event.event },
              actors,
            ),
          );
        return { status: "accepted" as const, replay: false, rows };
      });
      for (const row of outcome.rows) schedule(row.actorId);
      return outcome;
    },
    attach(target) {
      requireRunning();
      const write = { ...target.persist(), actorId: target.actorId };
      if (save(write) === "errored") {
        hold(target.actorId, "Actor returned an errored snapshot");
        return;
      }
      targets.set(target.actorId, target);
      update(write);
      schedule(target.actorId);
      if (!resuming) deadlines.arm();
    },
    persist(actorId) {
      requireRunning();
      if (delivering.has(actorId)) return;
      const target = targets.get(actorId);
      if (!target) throw new ActorNotLoadedError(actorId);
      const write = { ...target.persist(), actorId };
      if (save(write) === "errored") hold(actorId, "Actor returned an errored snapshot");
      else update(write);
      if (!resuming) deadlines.arm();
    },
    stop() {
      if (stopped) return;
      stopped = true;
      if (immediate !== undefined) clearImmediate(immediate);
      immediate = undefined;
      scheduled.clear();
      deadlines.stop();
      for (const target of targets.values()) target.stop?.();
      targets.clear();
    },
  };
  try {
    host.connect?.(router);
    const snapshots = store.activeSnapshots();
    for (const stored of snapshots) update(stored);
    for (const stored of snapshots) {
      const outcome = host.restore(stored, router);
      if (outcome.status === "held") hold(stored.actorId, outcome.reason);
      else targets.set(stored.actorId, outcome.target);
    }
    for (const stored of snapshots) schedule(stored.actorId);
    while (scheduled.size) {
      if (stopped) break;
      drainPass();
    }
    afterDrain?.();
    resuming = false;
    for (const actorId of scheduled) schedule(actorId);
    if (!stopped) deadlines.arm();
    return router;
  } catch (error) {
    router.stop();
    throw error;
  }
}
