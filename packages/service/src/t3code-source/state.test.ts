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
