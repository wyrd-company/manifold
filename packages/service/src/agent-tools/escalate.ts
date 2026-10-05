// ---
// relationships:
//   implements: agent-tools
// ---
import type { EscalateInput } from "../escalations/index.ts";
import { agentThreadTopic, eventId } from "./calls.ts";
import { refuse } from "./types.ts";
import type { AgentToolsOptions, Identity } from "./types.ts";
export function escalate(options: AgentToolsOptions, identity: Identity, input: EscalateInput) {
  const id = eventId(identity, "escalate");
  const result = options.store.connection.transaction(() => {
    const db = options.store.connection.database;
    const key = [identity.environment, identity.environmentId, identity.threadId, identity.turnId];
    const existing = db
      .prepare(
        "SELECT escalation_id FROM agenttool_question WHERE environment=? AND environment_id=? AND thread_id=? AND turn_id=?",
      )
      .get(...key);
    if (existing) return { escalationId: String(existing["escalation_id"]), replay: true };
    const actorId = options.actors().followers(identity.environment, identity.threadId)[0];
    if (!actorId) return refuse("not-followed", "No active task follows this thread.");
    const question = options.escalations().raise({
      kind: "agent-question",
      subject: {
        actorId,
        environment: identity.environment,
        threadId: identity.threadId,
        turnId: identity.turnId,
      },
      question: input.question,
      title: input.title ?? "Question",
      choices: input.choices ?? [],
      freeText: input.freeText ?? false,
    });
    db.prepare("INSERT INTO agenttool_question VALUES(?,?,?,?,?,?,?)").run(
      ...key,
      question.id,
      actorId,
      Date.now(),
    );
    const published = options.router().publish({
      source: "agent",
      eventId: id,
      topics: [agentThreadTopic(identity.environment, identity.threadId)],
      event: {
        type: "agent.escalated",
        environment: identity.environment,
        threadId: identity.threadId,
        turnId: identity.turnId,
        escalationId: question.id,
        title: question.title,
        question: question.question,
        choices: question.choices.map((choice) => ({ ...choice })),
        freeText: question.freeText,
      },
    });
    if (published.status === "rejected") throw new Error("Invalid agent escalation event");
    return { escalationId: question.id, replay: false };
  });
  options.probe?.({ tool: "escalate", eventId: id, replay: result.replay });
  return {
    status: "raised" as const,
    ...result,
    threadId: identity.threadId,
    turnId: identity.turnId,
    message:
      "The question was sent. End your turn now. The answer arrives as a new message in this thread.",
  };
}
