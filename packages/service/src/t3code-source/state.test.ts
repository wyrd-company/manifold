// ---
// relationships:
//   verifies: t3code-environment-source
// ---
import { expect, test } from "vite-plus/test";
import { schemas } from "@wyrd-company/t3code-client";
import { threadState } from "./state.ts";
import { fixtureThread } from "./test-fixtures/server.ts";
test.each([
  "idle",
  "starting",
  "running",
  "ready",
  "interrupted",
  "stopped",
  "error",
  "future-status",
])("projects session status %s", (status) => {
  const base = fixtureThread();
  const thread = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...base,
    session: {
      threadId: base.id,
      status,
      providerName: "provider",
      runtimeMode: "full-access",
      activeTurnId: null,
      lastError: null,
      updatedAt: base.createdAt,
    },
  });
  expect(threadState(thread).session).toEqual(status === "future-status" ? null : thread.session);
});
test.each(["running", "completed", "interrupted", "error", "future-state"])(
  "projects turn state %s",
  (state) => {
    const base = fixtureThread();
    const thread = schemas.orchestrationReadModel.OrchestrationThread.parse({
      ...base,
      latestTurn: {
        turnId: "turn",
        state,
        requestedAt: base.createdAt,
        startedAt: base.createdAt,
        completedAt: null,
        assistantMessageId: null,
      },
    });
    expect(threadState(thread).turn).toEqual(state === "future-state" ? null : thread.latestTurn);
  },
);

test("snapshot message placement distinguishes requested, joined and unknown messages", async () => {
  const { snapshotPlacements } = await import("./state.ts");
  const base = fixtureThread();
  const thread = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...base,
    latestTurn: {
      turnId: "turn",
      state: "completed",
      requestedAt: "2026-01-01T00:00:00Z",
      startedAt: "2026-01-01T00:00:00Z",
      completedAt: "2026-01-01T00:02:00Z",
      assistantMessageId: null,
    },
    messages: [
      {
        id: "request",
        role: "user",
        turnId: null,
        streaming: false,
        text: "First",
        attachments: [],
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
      {
        id: "joined",
        role: "user",
        turnId: null,
        streaming: false,
        text: "Answer",
        attachments: [],
        createdAt: "2026-01-01T00:01:00Z",
        updatedAt: "2026-01-01T00:01:00Z",
      },
      {
        id: "unknown",
        role: "user",
        turnId: null,
        streaming: false,
        text: "Later",
        attachments: [],
        createdAt: "2026-01-01T00:03:00Z",
        updatedAt: "2026-01-01T00:03:00Z",
      },
    ],
  });
  expect(snapshotPlacements(thread)).toEqual([
    { messageId: "request", turnId: "turn", placement: "started" },
    { messageId: "joined", turnId: "turn", placement: "joined" },
    { messageId: "unknown", turnId: null, placement: "unknown" },
  ]);
});

test("an incoming message joins the running turn and a requesting message starts a new turn", async () => {
  const { eventPlacements } = await import("./state.ts");
  const base = fixtureThread();
  const thread = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...base,
    latestTurn: {
      turnId: "active",
      state: "running",
      requestedAt: base.createdAt,
      startedAt: base.createdAt,
      completedAt: null,
      assistantMessageId: null,
    },
  });
  const event = schemas.orchestrationEvents.OrchestrationEvent.parse({
    sequence: 1,
    eventId: "event",
    commandId: null,
    causationEventId: null,
    correlationId: null,
    metadata: {},
    occurredAt: base.createdAt,
    aggregateKind: "thread",
    aggregateId: base.id,
    type: "thread.message-sent",
    payload: {
      threadId: base.id,
      messageId: "answer",
      role: "user",
      turnId: null,
      streaming: false,
      text: "Answer",
      attachments: [],
      createdAt: base.createdAt,
      updatedAt: base.createdAt,
    },
  });
  const previous = { turnId: "active", messageId: "request", pendingMessageId: null };
  expect(
    eventPlacements(thread, event, previous, { ...previous, pendingMessageId: "answer" }),
  ).toEqual([{ messageId: "answer", turnId: "active", placement: "joined" }]);
});
