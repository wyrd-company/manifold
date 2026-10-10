// ---
// relationships:
//   verifies: retention
// ---
import type { ActorHost } from "../../actor-host/index.ts";
export function replayHost(): ActorHost {
  return {
    start: () => {},
    migrate: async () => ({ status: "current" }),
    onSaved: () => () => {},
    actorOf: () => undefined,
    followers: () => [],
    followedThreads: () => [],
    issueThreads: () => [],
    eventSchema: () => ({ status: "undeclared" }),
    release: async () => {},
    subscription: () => ({ topics: ["weather"] }),
    restore(stored) {
      let count = Number(
        (stored.snapshot["context"] as { count?: number } | undefined)?.count ?? 0,
      );
      return {
        status: "restored",
        target: {
          actorId: stored.actorId,
          send: () => {
            count++;
          },
          persist: () => ({
            machine: stored.machine,
            snapshot: { ...stored.snapshot, context: { count } },
          }),
        },
      };
    },
  };
}
