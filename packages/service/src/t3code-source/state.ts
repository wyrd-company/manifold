// ---
// relationships:
//   implements: t3code-environment-source
// ---
import { pendingRequests } from "@wyrd-company/t3code-client";
import type { OrchestrationThread } from "@wyrd-company/t3code-client";
import type { RoutedEvent } from "../router/index.ts";
import type { JsonValue } from "../store/index.ts";
export function compactThread(thread: OrchestrationThread): OrchestrationThread {
  return {
    ...thread,
    messages: [],
    proposedPlans: [],
    checkpoints: thread.checkpoints.map((checkpoint) => ({ ...checkpoint, files: [] })),
    activities: pendingRequests(thread).map((request) => request.activity),
  };
}
export function threadState(thread: OrchestrationThread) {
  return {
    projectId: thread.projectId,
    turn:
      thread.latestTurn && typeof thread.latestTurn.state === "string" ? thread.latestTurn : null,
    requests: pendingRequests(thread),
    session: thread.session && typeof thread.session.status === "string" ? thread.session : null,
  };
}
export function threadChanges(
  before: ReturnType<typeof threadState> | undefined,
  after: ReturnType<typeof threadState>,
): RoutedEvent[] {
  const changes: RoutedEvent[] = [];
  const turn = after.turn;
  if (turn && turn.turnId !== before?.turn?.turnId)
    changes.push({ type: "t3.turn.started", turnId: turn.turnId });
  if (
    turn &&
    turn.state !== "running" &&
    (before?.turn?.turnId !== turn.turnId || before.turn.state === "running")
  )
    changes.push({
      type: "t3.turn.settled",
      turnId: turn.turnId,
      state: turn.state as string,
      assistantMessageId: turn.assistantMessageId,
      error: turn.state === "error" ? (after.session?.lastError ?? null) : null,
    });
  for (const request of before?.requests ?? [])
    if (!after.requests.some((r) => r.requestId === request.requestId))
      changes.push({
        type: "t3.request.resolved",
        requestId: request.requestId,
        kind: request.kind,
      });
  for (const request of after.requests)
    if (!before?.requests.some((r) => r.requestId === request.requestId))
      changes.push({
        type: "t3.request.opened",
        requestId: request.requestId,
        kind: request.kind,
        detail: request.payload as JsonValue,
      });
  if (
    after.session?.status === "error" &&
    turn?.state !== "running" &&
    (before?.session?.status !== "error" || before.session.updatedAt !== after.session.updatedAt)
  )
    changes.push({
      type: "t3.session.failed",
      error: after.session.lastError,
      failedAt: after.session.updatedAt,
    });
  return changes;
}
