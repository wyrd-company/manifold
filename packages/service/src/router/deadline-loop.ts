// ---
// relationships:
//   implements: durable-event-delivery
// ---
import type { Store } from "../store/index.ts";
import type { RouterClock } from "./types.ts";

export const systemClock: RouterClock = {
  now: Date.now,
  setTimer(delay, wake) {
    const timer = setTimeout(wake, delay);
    return () => clearTimeout(timer);
  },
};

export function deadlineLoop(
  store: Store,
  clock: RouterClock,
  schedule: (actorId: string) => void,
) {
  let cancel: (() => void) | undefined;
  function arm() {
    cancel?.();
    cancel = undefined;
    const next = store.nextDeadlineAt();
    if (next === undefined) return;
    cancel = clock.setTimer(Math.min(2147483647, Math.max(0, next - clock.now())), () => {
      cancel = undefined;
      for (const deadline of store.dueDeadlines(clock.now())) {
        const row = store.fireDeadline(deadline, `deadline.${deadline.deadlineId}`);
        if (row) schedule(row.actorId);
      }
      arm();
    });
  }
  return {
    arm,
    stop() {
      cancel?.();
      cancel = undefined;
    },
  };
}
