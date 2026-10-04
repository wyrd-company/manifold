// ---
// relationships:
//   implements: escalations
// ---
import { fromCallback } from "xstate";
import type { EventObject } from "xstate";
import type { Escalation, EscalateInput } from "./types.ts";
import type { invocationOf as hostInvocationOf } from "../actor-host/index.ts";
import type { EscalationRows } from "./rows.ts";
export function escalationCallback(
  rows: EscalationRows,
  invocationOf: typeof hostInvocationOf,
  sent: Set<string>,
  waiting: Map<string, (escalation: Escalation) => void>,
  wake: () => void,
) {
  return fromCallback<EventObject, EscalateInput>((args) => {
    const escalation = rows.raiseBlueprint(invocationOf(args), args.input);
    let delivered = false;
    const deliver = (value: Escalation) => {
      if (delivered || value.status !== "answered" || rows.row(value.id)!.taken_at !== null) return;
      delivered = true;
      sent.add(value.id);
      args.sendBack({
        type: "escalation.answered",
        escalationId: value.id,
        answer: value.answer!.value,
        channel: value.answer!.channel,
      });
    };
    waiting.set(escalation.id, deliver);
    deliver(escalation);
    wake();
    return () => {
      if (waiting.get(escalation.id) === deliver) waiting.delete(escalation.id);
    };
  });
}
