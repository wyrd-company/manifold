// ---
// relationships:
//   implements: agent-tools
// ---
import type { Escalation, ServiceEscalationHandler } from "../escalations/index.ts";
import type { MessagePlacement } from "../t3code-source/index.ts";
import { agentThreadTopic, answerMessageId, answerText, encoded } from "./calls.ts";
import type { AgentToolsOptions } from "./types.ts";
interface AnswerRow {
  escalation_id: string;
  environment: string;
  thread_id: string;
  message_id: string;
  text: string;
  status: "pending" | "sent" | "failed";
  placed_at: number | null;
}
export function answers(options: AgentToolsOptions, signal: AbortSignal) {
  const db = options.store.connection.database;
  let running = false;
  let work: Promise<void> | undefined;
  function placed(row: AnswerRow, turnId: string | null) {
    const question = db
      .prepare("SELECT environment_id FROM agenttool_question WHERE escalation_id=?")
      .get(row.escalation_id)!;
    const escalation = db
      .prepare("SELECT answer,channel FROM escalation WHERE escalation_id=?")
      .get(row.escalation_id)!;
    db.prepare("UPDATE agenttool_answer SET turn_id=?,placed_at=? WHERE escalation_id=?").run(
      turnId,
      Date.now(),
      row.escalation_id,
    );
    const result = options.router().publish({
      source: "agent",
      eventId: [
        row.environment,
        String(question["environment_id"]),
        row.thread_id,
        "escalation",
        row.escalation_id,
        "answered",
      ]
        .map(encoded)
        .join("/"),
      topics: [agentThreadTopic(row.environment, row.thread_id)],
      event: {
        type: "agent.escalation.answered",
        environment: row.environment,
        threadId: row.thread_id,
        escalationId: row.escalation_id,
        answer: JSON.parse(String(escalation["answer"])) as { text: string } | { choice: string },
        channel: String(escalation["channel"]),
        messageId: row.message_id,
        turnId,
      },
    });
    if (result.status === "rejected") throw new Error("Invalid escalation answer event");
  }
  async function send() {
    while (!signal.aborted) {
      if (!running) return;
      const row = db
        .prepare(
          "SELECT * FROM agenttool_answer WHERE status='pending' ORDER BY written_at,escalation_id LIMIT 1",
        )
        .get() as unknown as AnswerRow | undefined;
      if (!row) return;
      try {
        const receipt = await options.threads.startTurn({
          environment: row.environment,
          threadId: row.thread_id,
          messageId: row.message_id,
          text: row.text,
          signal,
        });
        db.prepare(
          "UPDATE agenttool_answer SET status='sent',sequence=?,settled_at=? WHERE escalation_id=?",
        ).run(receipt.sequence, Date.now(), row.escalation_id);
      } catch (error) {
        if (signal.aborted) return;
        if (error && typeof error === "object" && "kind" in error && error.kind === "rejected") {
          options.store.connection.transaction(() => {
            db.prepare(
              "UPDATE agenttool_answer SET status='failed',error=?,settled_at=? WHERE escalation_id=?",
            ).run(
              String("message" in error ? error.message : error),
              Date.now(),
              row.escalation_id,
            );
            const fresh = db
              .prepare("SELECT * FROM agenttool_answer WHERE escalation_id=?")
              .get(row.escalation_id) as unknown as AnswerRow;
            if (fresh.placed_at === null) placed(fresh, null);
          });
          options.log({
            level: "error",
            event: "agent-answer-rejected",
            message: String("message" in error ? error.message : error),
          });
        } else {
          options.log({ level: "warn", event: "agent-answer-pending", message: String(error) });
          return;
        }
      }
    }
  }
  function wake() {
    if (!running || work) return;
    work = send()
      .catch((error: unknown) => {
        options.log({ level: "error", event: "agent-answer-failed", message: String(error) });
      })
      .finally(() => {
        work = undefined;
      });
  }
  const questionHandler: ServiceEscalationHandler = (escalation: Escalation) => {
    if (escalation.raiser.type !== "service" || !escalation.answer) return;
    const { environment, threadId } = escalation.raiser.subject;
    db.prepare(
      "INSERT INTO agenttool_answer(escalation_id,environment,thread_id,message_id,text,status,written_at) VALUES(?,?,?,?,?,'pending',?) ON CONFLICT(escalation_id) DO NOTHING",
    ).run(
      escalation.id,
      environment!,
      threadId!,
      answerMessageId(escalation.id),
      answerText(escalation),
      Date.now(),
    );
    return wake;
  };
  return {
    questionHandler,
    messagePlaced(placement: MessagePlacement) {
      options.store.connection.transaction(() => {
        const row = db
          .prepare(
            "SELECT * FROM agenttool_answer WHERE message_id=? AND environment=? AND thread_id=?",
          )
          .get(placement.messageId, placement.environment, placement.threadId) as unknown as
          | AnswerRow
          | undefined;
        if (row && row.status !== "failed" && row.placed_at === null) placed(row, placement.turnId);
      });
    },
    start() {
      running = true;
      wake();
    },
    async stop() {
      running = false;
      await work;
    },
  };
}
