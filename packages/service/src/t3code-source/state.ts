// ---
// relationships:
//   implements: t3code-environment-source
// ---
import { pendingRequests } from "@wyrd-company/t3code-client";
import type { OrchestrationThread, OrchestrationEvent } from "@wyrd-company/t3code-client";
import type { MessagePlacement } from "./types.ts";
import type { RoutedEvent } from "../router/index.ts";
import type { JsonValue } from "../store/index.ts";
export interface TurnAttribution {
  readonly turnId: string | null;
  readonly messageId: string | null;
  readonly pendingMessageId: string | null;
}
export const emptyAttribution: TurnAttribution = {
  turnId: null,
  messageId: null,
  pendingMessageId: null,
};
/** A snapshot proves an attribution only with a unique timestamp match. */
export function snapshotAttribution(
  thread: OrchestrationThread,
  previous = emptyAttribution,
): TurnAttribution {
  const turn = threadState(thread).turn;
  const users = thread.messages.filter((message) => message.role === "user");
  const matches = turn ? users.filter((message) => message.createdAt === turn.requestedAt) : [];
  const pending = users.filter((message) => !turn || message.createdAt > turn.requestedAt);
  const latestTime = pending.reduce(
    (at, message) => (message.createdAt > at ? message.createdAt : at),
    "",
  );
  const latest = pending.filter((message) => message.createdAt === latestTime);
  return {
    turnId: turn?.turnId ?? null,
    messageId:
      turn && turn.turnId === previous.turnId
        ? previous.messageId
        : matches.length === 1
          ? matches[0]!.id
          : null,
    pendingMessageId: latest.length === 1 ? latest[0]!.id : null,
  };
}
export function eventAttribution(
  thread: OrchestrationThread,
  event: OrchestrationEvent,
  previous: TurnAttribution,
): TurnAttribution {
  const pending =
    "type" in event && event.type === "thread.message-sent" && event.payload.role === "user"
      ? event.payload.messageId
      : previous.pendingMessageId;
  const turnId = threadState(thread).turn?.turnId ?? null;
  return turnId !== previous.turnId
    ? { turnId, messageId: turnId ? pending : null, pendingMessageId: null }
    : { ...previous, pendingMessageId: pending };
}
export function compactThread(thread: OrchestrationThread): OrchestrationThread {
  return {
    ...thread,
    messages: [],
    proposedPlans: [],
    checkpoints: thread.checkpoints.map((checkpoint) => ({ ...checkpoint, files: [] })),
    activities: pendingRequests(thread).map((request) => request.activity),
  };
}
const turnStates = new Set(["running", "completed", "interrupted", "error"]);
const sessionStatuses = new Set([
  "idle",
  "starting",
  "running",
  "ready",
  "interrupted",
  "stopped",
  "error",
]);
export function threadState(
  thread: OrchestrationThread,
  attribution = emptyAttribution,
): {
  projectId: OrchestrationThread["projectId"];
  turn: OrchestrationThread["latestTurn"];
  requests: ReturnType<typeof pendingRequests>;
  session: OrchestrationThread["session"];
  messageId: string | null;
} {
  return {
    projectId: thread.projectId,
    messageId: attribution.messageId,
    turn:
      thread.latestTurn &&
      typeof thread.latestTurn.state === "string" &&
      turnStates.has(thread.latestTurn.state)
        ? thread.latestTurn
        : null,
    requests: pendingRequests(thread),
    session:
      thread.session &&
      typeof thread.session.status === "string" &&
      sessionStatuses.has(thread.session.status)
        ? thread.session
        : null,
  };
}
export function threadChanges(
  before: ReturnType<typeof threadState> | undefined,
  after: ReturnType<typeof threadState>,
): RoutedEvent[] {
  const changes: RoutedEvent[] = [];
  const turn = after.turn;
  if (turn && turn.turnId !== before?.turn?.turnId)
    changes.push({ type: "t3.turn.started", turnId: turn.turnId, messageId: after.messageId });
  if (
    turn &&
    turn.state !== "running" &&
    (before?.turn?.turnId !== turn.turnId || before.turn.state === "running")
  )
    changes.push({
      type: "t3.turn.settled",
      turnId: turn.turnId,
      messageId: after.messageId,
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

export function snapshotPlacements(
  thread: OrchestrationThread,
  attribution = snapshotAttribution(thread),
): Omit<MessagePlacement, "environment" | "threadId">[] {
  const turn = threadState(thread).turn;
  return thread.messages
    .filter((message) => message.role === "user")
    .map((message) => {
      if (turn && attribution.messageId === message.id)
        return { messageId: message.id, turnId: turn.turnId, placement: "started" as const };
      if (
        turn &&
        turn.requestedAt < message.createdAt &&
        (turn.state === "running" ||
          (turn.completedAt !== null && turn.completedAt >= message.createdAt))
      )
        return { messageId: message.id, turnId: turn.turnId, placement: "joined" as const };
      return { messageId: message.id, turnId: null, placement: "unknown" as const };
    });
}
export function eventPlacements(
  thread: OrchestrationThread,
  event: OrchestrationEvent,
  previous: TurnAttribution,
  attribution: TurnAttribution,
): Omit<MessagePlacement, "environment" | "threadId">[] {
  const turn = threadState(thread).turn;
  if (
    "type" in event &&
    event.type === "thread.message-sent" &&
    event.payload.role === "user" &&
    turn?.state === "running"
  )
    return [
      { messageId: event.payload.messageId, turnId: turn.turnId, placement: "joined" as const },
    ];
  if (attribution.turnId !== previous.turnId && attribution.turnId && attribution.messageId)
    return [
      {
        messageId: attribution.messageId,
        turnId: attribution.turnId,
        placement: "started" as const,
      },
    ];
  return [];
}
