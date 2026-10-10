// ---
// relationships:
//   implements: operator-console
// ---
import { Link } from "@tanstack/react-router";
import type { TaskSummary } from "@wyrd-company/manifold-shared/tasks-api";
export function TaskCard({
  task,
  search,
}: {
  task: TaskSummary;
  search: { project?: string; item?: string };
}) {
  const reference = `${task.issue.repository}#${task.issue.number}`;
  return (
    <Link
      className="task-card"
      to="/board/task/$actorId"
      params={{ actorId: task.actorId }}
      search={search}
    >
      <div className="task-card-ref mono">
        {reference}
        {task.issue.state === "closed" ? <span className="muted">✓ Closed</span> : null}
      </div>
      <div className={task.issue.title === undefined ? "task-card-title muted" : "task-card-title"}>
        {task.issue.title ?? reference}
      </div>
      {task.portfolioItem ? <div className="task-card-item muted">{task.portfolioItem}</div> : null}
      {task.actor ? (
        <div className="task-card-actor">
          <span className={`status-dot ${task.actor.status}`} />
          <span className="mono">{task.actor.states[0]}</span>
          <span className="muted">{task.actor.status}</span>
        </div>
      ) : (
        <div className="muted">Waiting for intake</div>
      )}
      <div className="task-card-badges">
        {task.openEscalations > 0 ? <span className="task-badge warning">Escalated</span> : null}
        {task.actor?.status === "held" ? <span className="task-badge failure">Failed</span> : null}
      </div>
    </Link>
  );
}
