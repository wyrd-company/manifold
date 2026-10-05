// ---
// relationships:
//   implements: [operator-console, tasks-api]
// ---
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import { LockKeyhole, SearchX, RefreshCw, ExternalLink } from "lucide-react";
import { formatAmount, formatAmountExact } from "@wyrd-company/manifold-shared/amounts";
import { fetchTask } from "../../api/tasks.ts";
import { Button } from "../../ui/button.tsx";
import { EmptyState } from "../EmptyContent.tsx";
import { EscalationPanel, answerLabel } from "./EscalationPanel.tsx";
export function TaskContent() {
  const { actorId } = useParams({ from: "/board/task/$actorId" }),
    search = useSearch({ from: "/board/task/$actorId" });
  const query = useQuery({
    queryKey: ["task", actorId],
    queryFn: () => fetchTask(actorId),
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    retry: false,
  });
  const result = query.data;
  if (!result) return <p role="status">Loading task…</p>;
  if (result.kind === "missing")
    return (
      <EmptyState
        icon={SearchX}
        title="Task not found"
        description="This issue is not on a bound Project."
      >
        <Link to="/board" search={search}>
          Board
        </Link>
      </EmptyState>
    );
  if (result.kind === "failed")
    return (
      <div role="alert" className="error-alert">
        <p>{result.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  const task = result.task,
    actor = task.actor,
    reference = `${task.issue.repository}#${task.issue.number}`,
    latestThread = task.threads.findLast((t) => t.url);
  return (
    <>
      <div className="task-back">
        <Link to="/board" search={search}>
          ← Board
        </Link>
        <span className="mono muted">{reference}</span>
        <span className="toolbar-space" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh task"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      <div className="task-header">
        <div>
          <div className="mono muted">{reference}</div>
          <h1>{task.issue.title ?? reference}</h1>
          <div className="task-card-badges">
            {task.projects.map((p) => (
              <span className="task-badge" key={p.binding}>
                <span className="status-dot" />
                {p.status ?? "No status"}
              </span>
            ))}
          </div>
          <p className="muted">
            {task.portfolioItem}
            {actor?.blueprint ? ` · ${actor.blueprint.path}` : ""}
          </p>
        </div>
        <div className="task-actions">
          {task.issue.url ? (
            <a className="task-link outline" href={task.issue.url} target="_blank" rel="noreferrer">
              Open on GitHub <ExternalLink size={14} />
            </a>
          ) : null}
          {latestThread?.url ? (
            <a
              className="task-link primary"
              href={latestThread.url}
              target="_blank"
              rel="noreferrer"
            >
              Open thread <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>
      <div className="task-columns">
        <div className="task-main">
          <EscalationPanel
            key={`${task.actorId}:${task.escalations.open.map((e) => e.id).join(",")}`}
            escalations={task.escalations.open}
            actorId={task.actorId}
          />
          <section className="task-section">
            <h2>Current actor</h2>
            {actor ? (
              <>
                <span className={`task-badge ${actor.status}`}>{actor.status}</span>
                {actor.states.map((state) => (
                  <p className="state-path mono" key={state}>
                    <span className={`status-dot ${actor.status}`} />
                    {state}
                  </p>
                ))}
                <p className="mono">
                  {actor.blueprint
                    ? `${actor.blueprint.path} · ${actor.blueprint.commit.slice(0, 7)}`
                    : actor.machine}
                </p>
                {actor.environment !== undefined ? (
                  <p className="mono">{actor.environment}</p>
                ) : null}
                <small>Saved {new Date(actor.savedAt).toLocaleString()}</small>
              </>
            ) : (
              <p className="muted">Waiting for intake</p>
            )}
          </section>
          <section className="task-section">
            <h2>Threads</h2>
            {task.threads.length ? (
              <table className="task-table">
                <thead>
                  <tr>
                    <th>Thread</th>
                    <th>Turn</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {task.threads.map((thread) => (
                    <tr key={thread.threadId}>
                      <td>
                        {thread.title ?? <span className="mono">{thread.threadId}</span>}
                        {thread.archived ? <small>Archived</small> : null}
                      </td>
                      <td>
                        <span className="state-path">
                          {thread.turn ? (
                            <>
                              <span className={`status-dot ${thread.turn}`} />
                              {thread.turn}
                            </>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </span>
                      </td>
                      <td>
                        {thread.url ? (
                          <a
                            href={thread.url}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="Open in T3 Code"
                          >
                            <ExternalLink size={15} />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No threads recorded.</p>
            )}
          </section>
          <section className="task-section">
            <h2>Escalations</h2>
            {task.escalations.recent.length ? (
              task.escalations.recent.map((e) => (
                <div className="recent-escalation" key={e.id}>
                  <strong>{e.title}</strong>
                  <span className="task-badge">{e.status}</span>
                  {e.answer ? (
                    <p>
                      {answerLabel(e)} <span className="muted">({e.answer.channel})</span>
                    </p>
                  ) : null}
                  {e.closedAt !== undefined ? (
                    <small>{new Date(e.closedAt).toLocaleString()}</small>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="muted">No recent escalations.</p>
            )}
          </section>
        </div>
        <div className="task-side">
          <section className="task-section">
            <h2>Fields</h2>
            {task.projects.map((p) => (
              <div className="task-field" key={p.binding}>
                <span className="muted">
                  {p.owner} / {p.number}
                  <small>{p.field ?? "Lifecycle"}</small>
                </span>
                <span>
                  {p.status ?? "No status"}{" "}
                  <LockKeyhole size={12} aria-label="Manifold sets this field" />
                </span>
              </div>
            ))}
          </section>
          <section className="task-section">
            <h2>Usage</h2>
            {task.usage.accounts.length ? (
              <>
                <table className="task-table usage-table">
                  <thead>
                    <tr>
                      {["Account", "Estimate", "Actual", "Variance", "Reserved"].map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {task.usage.accounts.map((account) => (
                      <tr key={account.account}>
                        <td>{account.account}</td>
                        <td title={formatAmountExact(account.estimate, account.unit)}>
                          {formatAmount(account.estimate, account.unit)}
                        </td>
                        <td title={formatAmountExact(account.actual, account.unit)}>
                          {formatAmount(account.actual, account.unit)}
                        </td>
                        <td
                          title={formatAmountExact(account.variance, account.unit)}
                          className={account.variance > 0 ? "warning-text" : ""}
                        >
                          {formatAmount(account.variance, account.unit, { signed: true })}
                        </td>
                        <td title={formatAmountExact(account.reserved, account.unit)}>
                          {formatAmount(account.reserved, account.unit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <small>{task.usage.settled ? "Settled" : "Open"}</small>
              </>
            ) : (
              <p className="muted">No usage recorded.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
