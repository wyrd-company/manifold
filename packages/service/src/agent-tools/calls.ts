// ---
// relationships:
//   implements: agent-tools
// ---
import { derivedId } from "../agent-threads/ids.ts";
import type { Escalation } from "../escalations/index.ts";
import type { ThreadMessage } from "@wyrd-company/manifold-shared";
import type { Identity } from "./types.ts";
export const encoded = (id: string) => encodeURIComponent(id).replaceAll(".", "%2E");
export const agentThreadTopic = (environment: string, threadId: string) =>
  `agent.environment.${environment}.thread.${encoded(threadId)}`;
export function callId(meta: Record<string, unknown>) {
  for (const key of ["claudecode/toolUseId", "callId"]) {
    const id = meta[key];
    if (typeof id === "string" && id.length) return id;
  }
  return undefined;
}
export function eventId(identity: Identity, tool: string) {
  return [
    identity.environment,
    identity.environmentId,
    identity.threadId,
    "turn",
    identity.turnId,
    tool,
  ]
    .map(encoded)
    .join("/");
}
export const answerMessageId = (id: string) => derivedId("agent-tools/answer-message", id);
export function answerText(escalation: Escalation) {
  const answer = escalation.answer!.value;
  const prefix = `Answer to your question "${escalation.title}":`;
  return "text" in answer
    ? `${prefix}\n\n${answer.text}\n\nContinue your work with this answer.`
    : `${prefix} ${escalation.choices.find((c) => c.id === answer.choice)!.label} (choice \`${answer.choice}\`).\n\nContinue your work with this answer.`;
}

export const messageId = (
  invocation: { actorId: string; invokeId: string; entryId: string },
  environment: string,
  threadId: string,
) =>
  derivedId(
    "agent-tools/message",
    invocation.actorId,
    invocation.invokeId,
    invocation.entryId,
    environment,
    threadId,
  );
export function readText(batch: readonly ThreadMessage[]) {
  if (!batch.length) return "You have no messages.";
  return (
    `You have ${batch.length} ${batch.length === 1 ? "message" : "messages"}.` +
    batch
      .map(
        (message, i) =>
          `\n\nMessage ${i + 1} of ${batch.length}, from task \`${message.from.actorId}\`, sent ${message.sentAt}:\n\n${message.text}`,
      )
      .join("")
  );
}
export function noticeText(count: number | bigint) {
  return count
    ? `Manifold: ${count} new ${count === 1 || count === 1n ? "message" : "messages"} for this thread. Read them with the manifold get-messages tool when your current step is done. Do not stop or end your turn for them.`
    : null;
}
