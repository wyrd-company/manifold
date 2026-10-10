// ---
// relationships:
//   implements: operator-console
// ---
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { Task } from "@wyrd-company/manifold-shared/tasks-api";
import { historyQuery } from "./actor-reads.ts";
import { actorTimeline } from "./actor-model.ts";
import { TimelineBar, durationLabel } from "./TimelineBar.tsx";
export function TaskActorTimeline({ actorId, task }: { actorId: string; task: Task }) {
  const history = useQuery(historyQuery(actorId));
  const timeline =
    history.data?.kind === "ok"
      ? actorTimeline({
          history: history.data.history,
          usage: undefined,
          escalations: [...task.escalations.open, ...task.escalations.recent],
          held: task.actor?.status === "held",
          now: history.dataUpdatedAt,
        })
      : undefined;
  return (
    <div className="task-actor-timeline">
      {timeline ? (
        <>
          <TimelineBar timeline={timeline} />
          <div className="actor-visit-durations">
            {timeline.rows.map((r) => (
              <small key={r.visit}>
                {r.states.join(", ")} · {durationLabel(r.end - r.start)}
              </small>
            ))}
          </div>
        </>
      ) : !history.data ? (
        <span className="muted">…</span>
      ) : null}
      <Link to="/actors/$actorId" params={{ actorId }}>
        Open actor
      </Link>
    </div>
  );
}
