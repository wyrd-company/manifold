// ---
// relationships:
//   implements: agent-tools
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
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
        .prepare(
          "SELECT CAST(environment AS BLOB) AS environment, CAST(thread_id AS BLOB) AS thread_id, CAST(turn_id AS BLOB) AS turn_id FROM agenttool_question WHERE actor_id=?",
        )
        .all(save.actorId)
        .map(readAgenttoolQuestion);
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

function readAgenttoolQuestion<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    environment: storedText(values["environment"]!),
    thread_id: storedText(values["thread_id"]!),
    turn_id: storedText(values["turn_id"]!),
  } as T;
}
