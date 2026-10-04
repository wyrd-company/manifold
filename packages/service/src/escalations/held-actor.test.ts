// ---
// relationships:
//   verifies: [escalations, durable-event-delivery]
// ---
import { expect, test } from "vite-plus/test";
import { startRouter } from "../router/index.ts";
import { openEscalations, heldActorHandler } from "./index.ts";
import type { Router } from "../router/index.ts";
import { fixture } from "./test-support.ts";
test("retry after a delivery error raises a new occurrence, then a fix drains the held inbox", async () => {
  const f = fixture();
  let router: Router | undefined;
  let failing = true;
  let restored = 0;
  const module = openEscalations({
    store: f.store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "held-actor": heldActorHandler((id) => router!.release(id)),
      "stranded-token": () => {},
    },
  });
  try {
    f.store.saveSnapshot({
      actorId: "parcel",
      machine: "delivery",
      snapshot: { status: "active", value: "waiting", context: { received: [] } },
    });
    router = startRouter({
      store: f.store,
      host: {
        subscription: () => ({ topics: ["weather.station"], events: ["reading"] }),
        restore(stored) {
          restored++;
          let errored = false;
          const received: string[] = [];
          return {
            status: "restored",
            target: {
              actorId: stored.actorId,
              send(row) {
                if (failing) errored = true;
                else received.push(row.eventId);
              },
              persist() {
                return {
                  machine: "delivery",
                  snapshot: errored
                    ? { status: "error" }
                    : { status: "active", value: "waiting", context: { received } },
                };
              },
            },
          };
        },
      },
      onHeld: (held) =>
        module.raise({
          kind: "held-actor",
          subject: { actorId: held.actorId },
          question: "Delivery failed",
          choices: [
            { id: "retry", label: "Retry" },
            { id: "dismiss", label: "Dismiss" },
          ],
        }),
    });
    router.publish({
      source: "weather",
      eventId: "first",
      topics: ["weather.station"],
      event: { type: "reading" },
    });
    await new Promise((resolve) => setImmediate(resolve));
    const first = module.list({ status: "open" })[0]!;
    expect(first).toBeDefined();
    module.answer(first.id, { choice: "retry" }, "api");
    await new Promise((resolve) => setImmediate(resolve));
    const second = module.list({ status: "open" })[0]!;
    expect(second.raiser).toMatchObject({ occurrence: 2 });
    failing = false;
    module.answer(second.id, { choice: "retry" }, "api");
    await new Promise((resolve) => setImmediate(resolve));
    expect(f.store.pendingInbox("parcel")).toHaveLength(0);
    expect(f.store.loadSnapshot("parcel")?.snapshot["context"]).toEqual({
      received: ["weather:first"],
    });
    expect(restored).toBe(3);
  } finally {
    router?.stop();
    await module.stop();
    await f.close();
  }
});
