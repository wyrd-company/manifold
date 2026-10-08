// ---
// relationships:
//   implements: operator-console
// ---
import { Link } from "@tanstack/react-router";
import { Activity } from "lucide-react";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import type { Task } from "@wyrd-company/manifold-shared/tasks-api";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "../../ui/table.tsx";
import { EmptyState } from "../EmptyContent.tsx";
import { currentThread, elapsedLabel } from "./active-actors.ts";
import type { ActiveActorRow } from "./active-actors.ts";
export function ActiveActorsTable({
  rows,
  portfolio,
  tasks,
  now,
}: {
  rows: readonly ActiveActorRow[] | undefined;
  portfolio: PortfolioResponse | undefined;
  tasks: readonly Task[];
  now: number;
}) {
  return !rows ? (
    <p role="status">Waiting for actors…</p>
  ) : rows.length === 0 ? (
    <EmptyState
      icon={Activity}
      title="No active actors"
      description="Actors appear here while a blueprint runs."
    />
  ) : (
    <>
      <div className="overview-section-caption">
        <span>{rows.length} active actors</span>
        {rows.length > 10 ? <Link to="/actors">View all</Link> : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {["Task", "Portfolio item", "Current state", "Updated", "Thread"].map((label) => (
              <TableHead key={label}>{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, 10).map((row) => {
            const thread = currentThread(
              tasks.find((task) => task.actorId === row.actor.actorId)?.threads ?? [],
            );
            return (
              <TableRow key={row.actor.actorId}>
                <TableCell>
                  {row.task ? (
                    <>
                      <Link to="/board/task/$actorId" params={{ actorId: row.actor.actorId }}>
                        {row.task.title ?? row.actor.actorId}
                      </Link>
                      <small className="mono">{row.task.reference}</small>
                    </>
                  ) : (
                    <span className="mono">{row.actor.actorId}</span>
                  )}
                  <small className="mono muted">
                    {row.actor.blueprint?.path ?? row.actor.machine}
                  </small>
                </TableCell>
                <TableCell>
                  {row.actor.portfolioItem ? (
                    (portfolio?.items.find((item) => item.id === row.actor.portfolioItem)?.title ??
                    row.actor.portfolioItem)
                  ) : (
                    <span className="muted">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="overview-actor-status">
                    <span
                      className={`status-dot ${row.status === "held" ? "overview-held-dot" : ""}`}
                      aria-hidden="true"
                    />
                    {row.status === "held" ? "Held" : "Running"}
                  </span>
                  {row.actor.states.map((state) => (
                    <small className="mono" key={state}>
                      {state}
                    </small>
                  ))}
                </TableCell>
                <TableCell className="muted">
                  {elapsedLabel(now - Date.parse(row.actor.savedAt))}
                </TableCell>
                <TableCell>
                  {thread?.url ? (
                    <a href={thread.url} target="_blank" rel="noreferrer">
                      Open thread
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
