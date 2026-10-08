// ---
// relationships:
//   implements: retention
// ---
import { sourceEventSources, pruneSourceEvents } from "../router/index.ts";
import { pruneGateEvaluations } from "../gates/index.ts";
import type { PrunableActor } from "../store/index.ts";
import { cutoffs } from "./cutoffs.ts";
import { protections } from "./protections.ts";
import type { Retention, RetentionOptions, PruneResult, RetentionClock } from "./types.ts";
const systemClock: RetentionClock = {
  now: Date.now,
  setTimer(delay, wake) {
    const timer = setTimeout(wake, delay);
    timer.unref();
    return () => clearTimeout(timer);
  },
  yield: (next) => {
    setImmediate(next);
  },
};
const empty = () => ({
  actors: 0,
  inboxRows: 0,
  historyRows: 0,
  sourceEvents: 0,
  gateEvaluations: 0,
});
export function openRetention({
  store,
  history,
  escalations,
  configuration,
  log,
  clock = systemClock,
  probe,
}: RetentionOptions): Retention {
  let running: Promise<PruneResult> | undefined;
  let cancel: (() => void) | undefined;
  let started = false,
    stopped = false;
  function arm(delay: number) {
    cancel?.();
    cancel = clock.setTimer(delay, () => {
      cancel = undefined;
      void retention.prune().catch(() => {});
    });
  }
  const next = () => new Promise<void>((resolve) => clock.yield(resolve));
  async function pass() {
    const result = empty(),
      times = cutoffs(configuration, clock.now());
    const kept = () => protections(escalations.list({ status: "open" }));
    if (times.history !== undefined) {
      let after: PrunableActor | undefined;
      for (;;) {
        if (stopped) break;
        const actors = store.prunableEnded({
          endedBefore: times.history,
          ...(after ? { after } : {}),
          limit: 100,
        });
        const keep = kept();
        for (const actor of actors) {
          if (keep.actors.has(actor.actorId)) continue;
          const pruned = store.connection.transaction(() => {
            const outcome = store.pruneEnded(actor.actorId);
            return outcome.status === "pruned"
              ? { inboxRows: outcome.inboxRows, historyRows: history.prune(actor.actorId) }
              : undefined;
          });
          if (pruned) {
            result.actors++;
            result.inboxRows += pruned.inboxRows;
            result.historyRows += pruned.historyRows;
            probe?.("actor-pruned", actor.actorId);
          }
        }
        after = actors.at(-1);
        await next();
        if (actors.length < 100) break;
      }
    }
    if (!stopped)
      for (const source of sourceEventSources(store.connection)) {
        const acceptedBefore = times.source(source);
        if (acceptedBefore === undefined) continue;
        for (;;) {
          if (stopped) break;
          kept();
          const count = pruneSourceEvents(store.connection, {
            source,
            acceptedBefore,
            limit: 1000,
          });
          result.sourceEvents += count;
          await next();
          if (count < 1000) break;
        }
      }
    if (times.gates !== undefined)
      for (;;) {
        if (stopped) break;
        const keep = kept();
        const count = pruneGateEvaluations(store.connection, {
          evaluatedBefore: times.gates,
          keepGates: keep.gates,
          limit: 1000,
        });
        result.gateEvaluations += count;
        await next();
        if (count < 1000) break;
      }
    if (Object.values(result).some((count) => count > 0))
      log({
        level: "info",
        event: "retention-pruned",
        message: "Store retention pass completed",
        detail: result,
      });
    return result;
  }
  const retention: Retention = {
    prune() {
      if (running) return running;
      if (stopped) return Promise.resolve(empty());
      cancel?.();
      cancel = undefined;
      // Defer execution so callers can join even a pass with no batches.
      running = Promise.resolve()
        .then(pass)
        .catch((error: unknown) => {
          log({
            level: "error",
            event: "retention-failed",
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        })
        .finally(() => {
          running = undefined;
          if (started && !stopped) arm(60 * 60 * 1000);
        });
      return running;
    },
    start() {
      if (started || stopped) return;
      started = true;
      if (!running) arm(5 * 60 * 1000);
    },
    async stop() {
      stopped = true;
      cancel?.();
      cancel = undefined;
      await running?.catch(() => {});
    },
  };
  return retention;
}
