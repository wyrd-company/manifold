// ---
// relationships:
//   verifies: operator-console
// ---
import type { ActorHistory } from "@wyrd-company/manifold-shared/actors-api";
import type { ActorModelInput } from "./actor-model.ts";
export const at = (n: number) => new Date(n * 1000).toISOString();
export function sampleHistory(active = false): ActorHistory {
  return {
    actor: {
      actorId: "task:parcel",
      machine: "sample",
      states: [active ? "packing" : "delivered"],
      savedAt: at(9),
      status: active ? "active" : "done",
      portfolioItem: "alpha",
      issue: "parcel",
      environment: "sample",
    },
    visits: [
      {
        visit: 1,
        value: "waiting",
        states: ["waiting"],
        machine: "sample",
        enteredAt: at(0),
        exitedAt: at(1),
        exitEvent: { type: "github.project-item.field-changed", eventId: "move-1" },
      },
      {
        visit: 2,
        value: "packing",
        states: ["packing"],
        machine: "sample",
        enteredAt: at(1),
        ...(active
          ? {}
          : { exitedAt: at(7), exitEvent: { type: "agent.handoff", eventId: "handoff" } }),
      },
      ...(active
        ? []
        : [
            {
              visit: 3,
              value: "delivered",
              states: ["delivered"],
              machine: "sample",
              enteredAt: at(7),
            },
          ]),
    ],
    commands: [
      {
        commandId: "create",
        kind: "thread-create",
        environment: "sample",
        threadId: "thread-a",
        invokeId: "create",
        entryId: "one",
        sentAt: at(1),
      },
      {
        commandId: "start",
        kind: "turn-start",
        environment: "sample",
        threadId: "thread-a",
        turnId: "turn-a",
        invokeId: "run",
        entryId: "one",
        sentAt: at(2),
      },
    ],
    events: [
      {
        eventId: "move-1",
        type: "github.project-item.field-changed",
        topic: "github.project.sample",
        receivedAt: at(1),
        consumedAt: at(1),
        visit: 1,
        payload: {
          type: "github.project-item.field-changed",
          field: { nodeId: "status-field", name: "Status" },
          to: { kind: "single-select", optionId: "packing", name: "Packing" },
          movedBy: { actorId: "task:parcel", confirmed: true },
        },
      },
      ...(active
        ? []
        : [
            {
              eventId: "handoff",
              type: "agent.handoff",
              topic: "agent.sample",
              receivedAt: at(7),
              consumedAt: at(7),
              visit: 2,
              payload: { type: "agent.handoff", threadId: "thread-a", turnId: "turn-a" },
            },
            {
              eventId: "move-2",
              type: "github.project-item.field-changed",
              topic: "github.project.sample",
              receivedAt: at(8),
              consumedAt: at(8),
              visit: 3,
              payload: {
                type: "github.project-item.field-changed",
                field: { nodeId: "status-field", name: "Status" },
                to: { kind: "single-select", optionId: "delivered", name: "Delivered" },
                movedBy: { actorId: "task:parcel", confirmed: true },
              },
            },
          ]),
    ],
    ...(active ? {} : { end: { status: "done", endedAt: at(9) } }),
  };
}
export const sampleInput = (active = false): ActorModelInput => ({
  history: sampleHistory(active),
  usage: {
    actorId: "task:parcel",
    tokens: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 10 },
    accounts: [{ account: "sample", actual: 10, unit: "usd" }],
    visits: [
      {
        visit: 2,
        enteredAt: at(1),
        tokens: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 10 },
        accounts: [{ account: "sample", actual: 10 }],
      },
    ],
    calls: [
      {
        usedAt: at(3),
        thread: { environment: "sample", threadId: "thread-a" },
        visit: 2,
        total: 10,
        account: "sample",
        actual: 10,
      },
    ],
  },
  escalations: [],
  held: false,
  now: 10000,
});
