// ---
// relationships:
//   verifies: actors-api
// ---
import { expect, test } from "vite-plus/test";
import { isActorsResponse } from "./actors-api.ts";
const actor = {
  actorId: "sample",
  machine: "sample",
  status: "active",
  states: ["ready"],
  savedAt: "2026-01-01T00:00:00.000Z",
};
test("accepts actor summaries and optional blueprint and identity fields", () => {
  expect(isActorsResponse({ actors: [] })).toBe(true);
  expect(
    isActorsResponse({
      actors: [
        actor,
        {
          ...actor,
          states: ["working.first.ready", "working.second.waiting"],
          blueprint: { path: "blueprints/sample.yaml", commit: "a".repeat(64) },
          environment: "sample-host",
          project: "sample-project",
          issue: "sample#1",
          portfolioItem: "sample-item",
        },
      ],
    }),
  ).toBe(true);
});
test("rejects malformed response bodies at the shared API boundary", () => {
  for (const value of [
    null,
    [],
    {},
    { actors: null },
    { actors: {} },
    { actors: [null] },
    { actors: [actor], extra: true },
  ])
    expect(isActorsResponse(value)).toBe(false);
  for (const [field, values] of Object.entries({
    status: [undefined, "error", "completed", null, ["active"]],
    actorId: [undefined, "", 1],
    machine: [undefined, "", 1],
    states: [undefined, "ready", [""], [1]],
    savedAt: [undefined, "bad", "2026-02-30T00:00:00.000Z"],
    environment: [null, 1],
    project: [null, 1],
    issue: [null, 1],
    portfolioItem: [null, 1],
    blueprint: [
      null,
      {},
      { path: "sample.yaml", commit: "a".repeat(40) },
      { path: "blueprints/sample.yml", commit: "a" },
      { path: "blueprints/sample.yml", commit: "a".repeat(40), extra: true },
    ],
    extra: [true],
  })) {
    for (const value of values)
      expect(isActorsResponse({ actors: [{ ...actor, [field]: value }] }), field).toBe(false);
  }
});

test("validates history members and encodes actor ids once", async () => {
  const { isActorHistoryResponse, actorHistoryPath } = await import("./actors-api.ts");
  const visit = {
    visit: 1,
    value: { packing: "ready" },
    states: ["packing.ready"],
    machine: "sample",
    enteredAt: actor.savedAt,
  };
  const event = {
    eventId: "scan",
    type: "scanned",
    topic: "parcel.scan",
    receivedAt: actor.savedAt,
    payload: { type: "scanned" },
  };
  const command = {
    commandId: "command",
    kind: "turn-start",
    environment: "station",
    threadId: "thread",
    messageId: "message",
    invokeId: "send",
    entryId: "1",
    sentAt: actor.savedAt,
  };
  const history = { actor, visits: [visit], events: [event], commands: [command] };
  expect(actorHistoryPath("parcel/a%")).toBe("/api/actors/parcel%2Fa%25/history");
  expect(isActorHistoryResponse({ history })).toBe(true);
  for (const [field, values] of Object.entries({
    visits: [
      null,
      [{ ...visit, visit: 0 }],
      [{ ...visit, machine: "" }],
      [{ ...visit, states: [0] }],
      [{ ...visit, enteredAt: "bad" }],
      [{ ...visit, exitedAt: "bad" }],
      [{ ...visit, blueprint: { path: "wrong", commit: "a" } }],
      [{ ...visit, extra: true }],
      [{ ...visit, value: [] }],
      [{ ...visit, exitEvent: { eventId: "scan" } }],
    ],
    events: [
      null,
      [{ ...event, receivedAt: "bad" }],
      [{ ...event, payload: undefined }],
      [{ ...event, payload: null }],
      [{ ...event, payload: { type: "" } }],
      [{ ...event, visit: 0 }],
      [{ ...event, topic: "" }],
      [{ ...event, consumedAt: "bad" }],
      [{ ...event, payload: { type: "scanned", bad: undefined } }],
      [{ ...event, extra: true }],
    ],
    commands: [
      null,
      [{ ...command, kind: "other" }],
      [{ ...command, threadId: "" }],
      [{ ...command, messageId: null }],
      [{ ...command, turnId: null }],
      [{ ...command, extra: true }],
      [{ ...command, sentAt: "bad" }],
      [{ ...command, acceptedAt: null }],
    ],
    end: [
      { status: "active", endedAt: actor.savedAt },
      { status: "done", endedAt: "bad" },
      { status: "done", endedAt: actor.savedAt, output: { bad: undefined } },
      { status: "done", endedAt: actor.savedAt, extra: true },
    ],
  })) {
    for (const value of values)
      expect(isActorHistoryResponse({ history: { ...history, [field]: value } }), field).toBe(
        false,
      );
  }
  expect(
    isActorHistoryResponse({
      history: {
        ...history,
        actor: { ...actor, status: "done" },
        end: { status: "done", endedAt: actor.savedAt, output: { label: "large" } },
      },
    }),
  ).toBe(true);
  expect(isActorHistoryResponse({ history, extra: true })).toBe(false);
});
