// ---
// relationships:
//   implements: agent-tools
// ---
import type { JsonValue } from "../store/index.ts";
import { agentThreadTopic, eventId } from "./calls.ts";
import { refuse } from "./types.ts";
import type { AgentToolsOptions, Identity } from "./types.ts";
export function handoff(options: AgentToolsOptions, identity: Identity, value: unknown) {
  const id = eventId(identity, "handoff");
  const replay = options.store.connection.transaction(() => {
    const event = {
      type: "agent.handoff",
      environment: identity.environment,
      threadId: identity.threadId,
      turnId: identity.turnId,
      handoff: value as JsonValue,
    };
    const result = options.router().publish({
      source: "agent",
      eventId: id,
      topics: [agentThreadTopic(identity.environment, identity.threadId)],
      event,
    });
    if (result.status === "rejected")
      return refuse("invalid-handoff", "Invalid handoff.", 422, [...result.issues]);
    if (result.replay) return true;
    if (!result.rows.length)
      return refuse(
        options.actors().followers(identity.environment, identity.threadId).length
          ? "not-accepted"
          : "not-followed",
        "No following process takes this handoff.",
      );
    const issues: { path: string; message: string }[] = [];
    for (const row of result.rows) {
      const schema = options.actors().eventSchema(row.actorId, "agent.handoff");
      if (schema.status === "unavailable")
        return refuse(
          "task-held",
          "A following task's process cannot load. Call again after it is restored.",
        );
      if (schema.status === "declared" && !schema.validate(event))
        for (const error of schema.validate.errors ?? [])
          issues.push({
            path:
              error.instancePath +
              (error.keyword === "required" ? "/" + String(error.params["missingProperty"]) : ""),
            message: error.message ?? "Invalid handoff",
          });
    }
    if (issues.length)
      return refuse("invalid-handoff", "Correct the handoff fields and call again.", 422, issues);
    return false;
  });
  options.probe?.({ tool: "handoff", eventId: id, replay });
  return {
    status: "accepted" as const,
    replay,
    eventId: id,
    threadId: identity.threadId,
    turnId: identity.turnId,
    message: replay
      ? "This turn's first handoff stands. End your turn now."
      : "The handoff was taken. End your turn now.",
  };
}
