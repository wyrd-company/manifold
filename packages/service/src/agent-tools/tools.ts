// ---
// relationships:
//   implements: agent-tools
// ---
import { agentToolSteps } from "./migrations.ts";
import { messages } from "./messages.ts";
import { answers } from "./answers.ts";
import { listener } from "./http.ts";
import type { AgentTools, AgentToolsOptions } from "./types.ts";
export function openAgentTools(options: AgentToolsOptions): AgentTools {
  options.store.connection.migrate("agenttool", agentToolSteps);
  const stopping = new AbortController();
  const mail = messages(options);
  const sender = answers(options, stopping.signal);
  return {
    ...sender,
    implementations: mail.implementations,
    requestListener: listener(options, stopping.signal, mail),
    saving(save) {
      mail.saving(save);
      if (save.snapshot.status !== "done" && save.snapshot.status !== "stopped") return;
      const rows = options.store.connection.database
        .prepare("SELECT environment,thread_id,turn_id FROM agenttool_question WHERE actor_id=?")
        .all(save.actorId);
      for (const row of rows)
        options.escalations().withdraw({
          kind: "agent-question",
          subject: {
            actorId: save.actorId,
            environment: String(row["environment"]),
            threadId: String(row["thread_id"]),
            turnId: String(row["turn_id"]),
          },
        });
    },
    async stop() {
      stopping.abort();
      await sender.stop();
    },
  };
}
