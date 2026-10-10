// ---
// relationships:
//   implements: [operator-console, escalation-contract]
// ---
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Escalation } from "@wyrd-company/manifold-shared/escalations-api";
import { answerEscalation } from "../../api/tasks.ts";
import { Button } from "../../ui/button.tsx";
export function answerLabel(escalation: Escalation) {
  const value = escalation.answer?.value;
  return value
    ? "text" in value
      ? value.text
      : (escalation.choices.find((c) => c.id === value.choice)?.label ?? value.choice)
    : "";
}
function EscalationBlock({ escalation, actorId }: { escalation: Escalation; actorId: string }) {
  const [text, setText] = useState("");
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (answer: Parameters<typeof answerEscalation>[1]) =>
      answerEscalation(escalation.id, answer),
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["tasks"], refetchType: "none" }),
        client.invalidateQueries({ queryKey: ["task", actorId], refetchType: "none" }),
      ]);
    },
  });
  const result = mutation.data;
  const outcome = result?.kind === "answered" || result?.kind === "closed" ? result : undefined;
  return (
    <section
      className={`escalation-block ${outcome?.kind === "answered" ? "success" : outcome ? "neutral" : "warning"}`}
      aria-label={escalation.title}
    >
      <h3>{escalation.title}</h3>
      <p className="escalation-question">{escalation.question}</p>
      {outcome ? (
        <p role="status">
          {outcome.kind === "answered"
            ? `Answered: ${answerLabel(outcome.escalation)}`
            : outcome.escalation.answer
              ? `Already answered: ${answerLabel(outcome.escalation)} (${outcome.escalation.answer.channel})`
              : "Withdrawn"}
        </p>
      ) : (
        <>
          <div className="escalation-controls">
            {escalation.choices.map((choice) => (
              <Button
                key={choice.id}
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ choice: choice.id })}
              >
                {choice.label}
              </Button>
            ))}
          </div>
          {escalation.freeText ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate({ text });
              }}
              className="escalation-controls"
            >
              <input
                aria-label={`Answer ${escalation.title}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={mutation.isPending}
              />
              <Button type="submit" variant="outline" disabled={mutation.isPending}>
                Answer
              </Button>
            </form>
          ) : null}
          <small>The first answer from any channel is recorded.</small>
          {result?.kind === "invalid" || result?.kind === "failed" ? (
            <p role="alert">{result.message}</p>
          ) : result?.kind === "missing" ? (
            <p role="alert">Escalation not found. Read the task again.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
export function EscalationPanel({
  escalations,
  actorId,
}: {
  escalations: readonly Escalation[];
  actorId: string;
}) {
  return escalations.length ? (
    <div className="escalation-panel">
      {escalations.map((escalation) => (
        <EscalationBlock key={escalation.id} escalation={escalation} actorId={actorId} />
      ))}
    </div>
  ) : null;
}
