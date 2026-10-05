// ---
// relationships:
//   implements: agent-tools
// ---
import { derivedId } from "../agent-threads/ids.ts";
import type { Escalation } from "../escalations/index.ts";
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
