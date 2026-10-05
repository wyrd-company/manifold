// ---
// relationships:
//   implements: escalations
// ---
import { invocationOf } from "../actor-host/index.ts";
import { escalationSteps } from "./migrations.ts";
import { escalationRows } from "./rows.ts";
import { invalidAnswer } from "./records.ts";
import { escalationCallback } from "./callback.ts";
import { notificationSender } from "./sender.ts";
import { escalationListeners } from "./http.ts";
import type {
  Escalations,
  EscalationsOptions,
  ServiceEscalationHandler,
  Escalation,
} from "./types.ts";
export function heldActorHandler(release: (actorId: string) => void): ServiceEscalationHandler {
  return (escalation) => {
    if (
      escalation.raiser.type === "service" &&
      escalation.answer?.value &&
      "choice" in escalation.answer.value &&
      escalation.answer.value.choice === "retry"
    ) {
      const actorId = escalation.raiser.subject["actorId"]!;
      return () => release(actorId);
    }
  };
}
export function openEscalations(options: EscalationsOptions): Escalations {
  const { store, configuration } = options;
  const now = () => options.clock?.now() ?? Date.now();
  store.connection.migrate("escalation", escalationSteps);
  const rows = escalationRows(store, configuration, now, (message) =>
    options.logger?.warn(message),
  );
  const sender = notificationSender(options, rows, now);
  const waiting = new Map<string, (escalation: Escalation) => void>();
  const sent = new Set<string>();
  function handle(id: string) {
    const after = store.connection.transaction(() => {
      const row = rows.row(id)!;
      if (row.status !== "answered" || row.kind === null || row.handled_at !== null) return;
      const handler = options.handlers[row.kind];
      if (!handler) return;
      const after = handler(rows.decode(row));
      store.connection.database
        .prepare("UPDATE escalation SET handled_at=? WHERE escalation_id=?")
        .run(now(), id);
      return after;
    });
    after?.();
  }
  const listeners = escalationListeners(rows, (id, answer, channel) =>
    module.answer(id, answer, channel),
  );
  const module: Escalations = {
    escalate: escalationCallback(rows, options.invocationOf ?? invocationOf, sent, waiting, () =>
      sender.wake(),
    ),
    saving(save) {
      if (save.snapshot.status === "error") return;
      const active =
        save.snapshot.status === "done" || save.snapshot.status === "stopped"
          ? []
          : save.activeInvokes;
      for (const row of rows.rows("SELECT * FROM escalation WHERE actor_id=?", save.actorId)) {
        if (sent.has(row.escalation_id) && row.status === "answered")
          store.connection.database
            .prepare("UPDATE escalation SET taken_at=COALESCE(taken_at,?) WHERE escalation_id=?")
            .run(now(), row.escalation_id);
        if (
          row.status === "open" &&
          !active.some((i) => i.invokeId === row.invoke_id && i.entryId === row.entry_id)
        )
          rows.withdrawId(row.escalation_id);
      }
      rows.withdraw({ kind: "held-actor", subject: { actorId: save.actorId } });
      sender.wake();
    },
    raise(request) {
      const escalation = rows.raise(request);
      sender.wake();
      return escalation;
    },
    withdraw(request) {
      store.connection.transaction(() => rows.withdraw(request));
      sender.wake();
    },
    answer(id, answer, channel) {
      const outcome = store.connection.transaction(() => {
        const escalation = rows.get(id);
        if (!escalation) return { status: "not-found" as const };
        if (escalation.status !== "open") return { status: "closed" as const, escalation };
        const invalid = invalidAnswer(escalation, answer);
        if (invalid) return { status: "invalid" as const, reason: invalid };
        store.connection.database
          .prepare(
            "UPDATE escalation SET status='answered',answer=?,channel=?,closed_at=? WHERE escalation_id=? AND status='open'",
          )
          .run(JSON.stringify(answer), channel, now(), id);
        rows.close(id);
        return { status: "answered" as const, escalation: rows.get(id)! };
      });
      if (outcome.status === "answered") {
        waiting.get(id)?.(outcome.escalation);
        handle(id);
        sender.wake();
      }
      return outcome;
    },
    get: rows.get,
    list: (filter) => rows.list(filter.status),
    ...listeners,
    start() {
      for (const row of rows.rows(
        "SELECT * FROM escalation WHERE status='answered' AND kind IS NOT NULL AND handled_at IS NULL ORDER BY raised_at",
      ))
        handle(row.escalation_id);
      sender.start();
    },
    async stop() {
      waiting.clear();
      sent.clear();
      await sender.stop();
    },
  };
  return module;
}
