// ---
// relationships:
//   implements: [operator-console, actors-api]
// ---
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { Activity, RefreshCw, ExternalLink } from "lucide-react";
import { fetchActors } from "../api/client.ts";
import { EmptyState } from "./EmptyContent.tsx";
import { Button } from "../ui/button.tsx";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table.tsx";
import { actorsSearch, filterActors } from "./actors/actor-list.ts";
import type { ActorsSearch } from "./actors/actor-list.ts";
import { actorReadOptions, historyQuery, usageQuery, taskQuery } from "./actors/actor-reads.ts";
import { actorTimeline } from "./actors/actor-model.ts";
import { TimelineBar, durationLabel } from "./actors/TimelineBar.tsx";
import { ActorUsageLabel } from "./actors/ActorTimeline.tsx";
export { actorsSearch };
export function ActorsContent() {
  const search = useSearch({ strict: false }) as ActorsSearch,
    navigate = useNavigate({ from: "/actors" }),
    client = useQueryClient(),
    status = search.status ?? "active";
  const query = useQuery({
    queryKey: ["actors", status],
    queryFn: () => fetchActors(status),
    ...actorReadOptions,
  });
  const actors = query.data?.kind === "ok" ? query.data.actors : [];
  const histories = useQueries({ queries: actors.map((a) => historyQuery(a.actorId)) }),
    usages = useQueries({ queries: actors.map((a) => usageQuery(a.actorId)) }),
    tasks = useQueries({ queries: actors.map((a) => taskQuery(a.actorId)) });
  const rows = actors.map((actor, index) => {
    const history = histories[index]!,
      usage = usages[index]!,
      task = tasks[index]!,
      detail = task.data?.kind === "ok" ? task.data.task : undefined;
    const input =
      history.data?.kind === "ok"
        ? {
            history: history.data.history,
            usage: usage.data?.kind === "ok" ? usage.data.usage : undefined,
            escalations: detail ? [...detail.escalations.open, ...detail.escalations.recent] : [],
            held: detail?.actor?.status === "held",
            now: history.dataUpdatedAt,
          }
        : undefined;
    return {
      actor,
      accounts: usage.data?.kind === "ok" ? usage.data.usage.accounts.map((a) => a.account) : [],
      history,
      usage,
      detail,
      input,
      timeline: input ? actorTimeline(input) : undefined,
    };
  });
  const filtered = filterActors(rows, search),
    hasFilters = !!(search.item || search.blueprint || search.environment || search.account);
  const filters = [
    {
      key: "item",
      label: "Portfolio item",
      values: actors.flatMap((a) => (a.portfolioItem ? [a.portfolioItem] : [])),
    },
    {
      key: "blueprint",
      label: "Blueprint",
      values: actors.map((a) => a.blueprint?.path ?? a.machine),
    },
    {
      key: "environment",
      label: "Environment",
      values: actors.flatMap((a) => (a.environment ? [a.environment] : [])),
    },
    { key: "account", label: "Account", values: rows.flatMap((r) => r.accounts) },
  ] as const;
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["actors", status] }),
      ...actors.flatMap((a) =>
        [
          ["actor-history", a.actorId],
          ["actor-usage", a.actorId],
          ["task", a.actorId],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      ),
    ]);
  return (
    <>
      <div className="actors-toolbar">
        <div className="actor-segmented" role="group" aria-label="Actor status">
          {(["active", "completed"] as const).map((s) => (
            <Button
              key={s}
              variant={status === s ? "secondary" : "ghost"}
              aria-pressed={status === s}
              onClick={() =>
                void navigate({ search: { ...search, status: s === "completed" ? s : undefined } })
              }
            >
              {s === "active" ? "Active" : "Completed"}
            </Button>
          ))}
        </div>
        {filters.map((f) => (
          <label key={f.key} className="actor-filter">
            {f.label}
            <select
              aria-label={f.label}
              value={search[f.key] ?? ""}
              onChange={(e) =>
                void navigate({ search: { ...search, [f.key]: e.target.value || undefined } })
              }
            >
              <option value="">All</option>
              {[...new Set([...f.values, ...(search[f.key] ? [search[f.key]!] : [])])]
                .sort()
                .map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
            </select>
          </label>
        ))}
        <span className="toolbar-space" />
        <span>{query.data?.kind === "ok" ? `${filtered.length} ${status} actors` : ""}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh actors"
          disabled={query.isFetching}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {!query.data ? (
        <p role="status">Loading actors…</p>
      ) : query.data.kind === "failed" ? (
        <div role="alert" className="error-alert">
          <p>{query.data.message}</p>
          <Button variant="outline" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ) : !filtered.length ? (
        <EmptyState
          icon={Activity}
          title={hasFilters ? "No actors match these filters" : `No ${status} actors`}
          description={
            hasFilters
              ? "Clear filters to see all actors."
              : status === "active"
                ? "Actors appear here while a blueprint runs."
                : "Actors appear here when they end."
          }
        >
          {hasFilters ? (
            <Button
              variant="outline"
              onClick={() => void navigate({ search: { status: search.status } })}
            >
              Clear filters
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Task",
                "Portfolio item",
                "Blueprint",
                status === "active" ? "Current state" : "Last state",
                "Environment",
                "Usage",
                "Time",
                "Timeline",
              ].map((l) => (
                <TableHead key={l}>{l}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const { actor, detail, timeline, usage, history, input } = row,
                reference = detail
                  ? `${detail.issue.repository}#${detail.issue.number}`
                  : (actor.issue ?? actor.actorId),
                thread = detail?.threads.findLast((t) => t.url);
              const unavailable = (r: { kind: string; message?: string } | undefined) =>
                r ? (
                  <span className="muted" title={r.message}>
                    —
                  </span>
                ) : (
                  <span className="muted">…</span>
                );
              return (
                <TableRow
                  key={actor.actorId}
                  className="actor-list-row"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a,button"))
                      void navigate({ to: "/actors/$actorId", params: { actorId: actor.actorId } });
                  }}
                >
                  <TableCell>
                    <Link
                      className="mono"
                      to="/actors/$actorId"
                      params={{ actorId: actor.actorId }}
                    >
                      {reference}
                    </Link>
                    {detail?.issue.title ? (
                      <small>{detail.issue.title}</small>
                    ) : actor.issue ? (
                      <small>{actor.actorId}</small>
                    ) : null}
                  </TableCell>
                  <TableCell>{actor.portfolioItem ?? "—"}</TableCell>
                  <TableCell className="mono">
                    {actor.blueprint?.path ?? actor.machine}
                    {actor.blueprint ? <small>{actor.blueprint.commit.slice(0, 7)}</small> : null}
                  </TableCell>
                  <TableCell>
                    {actor.states.map((s) => (
                      <div className="mono state-path" key={s}>
                        <span className={`status-dot ${input?.held ? "held" : ""}`} />
                        {s}
                      </div>
                    ))}
                    <small>
                      {input?.held ? "Failed" : status === "active" ? "Running" : "Completed"}
                    </small>
                    {status === "active" && thread?.url ? (
                      <a
                        href={thread.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open thread"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : null}
                  </TableCell>
                  <TableCell className="mono">{actor.environment ?? "—"}</TableCell>
                  <TableCell>
                    {usage.data?.kind === "ok" ? (
                      <ActorUsageLabel
                        tokens={usage.data.usage.tokens.total}
                        accounts={usage.data.usage.accounts}
                        tokenClasses={usage.data.usage.tokens}
                      />
                    ) : (
                      unavailable(usage.data)
                    )}
                  </TableCell>
                  <TableCell>
                    {timeline ? durationLabel(timeline.duration) : unavailable(history.data)}
                  </TableCell>
                  <TableCell>
                    {timeline ? <TimelineBar timeline={timeline} /> : unavailable(history.data)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
