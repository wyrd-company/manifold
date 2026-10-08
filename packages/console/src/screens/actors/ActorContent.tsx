// ---
// relationships:
//   implements: operator-console
// ---
import { Link, useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ActorUsageResponse } from "@wyrd-company/manifold-shared/actor-usage-api";
import { formatAmount } from "@wyrd-company/manifold-shared/amounts";
import { SearchX, RefreshCw } from "lucide-react";
import { Button } from "../../ui/button.tsx";
import { EmptyState } from "../EmptyContent.tsx";
import { actorTimeline, actorSequence, actorPasses } from "./actor-model.ts";
import { useActorReads } from "./actor-reads.ts";
import { ActorTimeline } from "./ActorTimeline.tsx";
import { ActorSequence } from "./ActorSequence.tsx";
import { durationLabel } from "./TimelineBar.tsx";
export const actorViewSearch = (s: Record<string, unknown>): { view?: "sequence" } =>
  s["view"] === "sequence" ? { view: "sequence" } : {};
export function ActorContent() {
  const { actorId } = useParams({ from: "/actors/$actorId" }),
    search = useSearch({ from: "/actors/$actorId" }),
    navigate = useNavigate({ from: "/actors/$actorId" }),
    client = useQueryClient();
  const { history, usage, task, input } = useActorReads(actorId);
  const refresh = () =>
    Promise.all(
      [
        ["actor-history", actorId],
        ["actor-usage", actorId],
        ["task", actorId],
      ].map((queryKey) => client.invalidateQueries({ queryKey })),
    );
  const failures = [history.data, usage.data, task.data].filter((r) => r?.kind === "failed");
  if (history.data?.kind === "missing")
    return (
      <EmptyState
        icon={SearchX}
        title="Actor not found"
        description="The store holds no history for this actor."
      >
        <Link to="/actors">Actors</Link>
      </EmptyState>
    );
  const timeline = input ? actorTimeline(input) : undefined,
    sequence = input ? actorSequence(input) : undefined,
    actor = input?.history.actor,
    detail = task.data?.kind === "ok" ? task.data.task : undefined;
  const reference = detail
      ? `${detail.issue.repository}#${detail.issue.number}`
      : (actor?.issue ?? actorId),
    thread = detail?.threads.findLast((t) => t.url);
  const prunedAt = input?.history.prunedAt;
  const removed = prunedAt
    ? `Retention removed this actor's events and commands on ${new Date(prunedAt).toLocaleString()}.`
    : undefined;
  const status = input?.held ? "Failed" : actor?.status === "active" ? "Running" : "Completed";
  return (
    <>
      <div className="actor-page-toolbar">
        <Link to="/actors">← All actors</Link>
        <span className="toolbar-space" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh actor"
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {failures.map((r) => (
        <div role="alert" className="error-alert" key={r?.kind === "failed" ? r.message : ""}>
          {r?.kind === "failed" ? r.message : ""}
          <Button variant="outline" onClick={() => void refresh()}>
            Try again
          </Button>
        </div>
      ))}
      {!history.data ? <p role="status">Loading actor…</p> : null}
      {history.data?.kind === "failed" ? (
        <>
          <h1>{detail?.issue.title ?? reference}</h1>
          <ActorStats usage={usage.data?.kind === "ok" ? usage.data.usage : undefined} />
        </>
      ) : null}
      {actor && timeline && sequence ? (
        <>
          <div className="actor-page-header">
            <div>
              <span className="mono muted">{reference}</span>
              <h1>
                {detail?.issue.title ?? reference}{" "}
                <span className={`task-badge ${input!.held ? "held" : actor.status}`}>
                  {status}
                </span>
              </h1>
              <p className="muted actor-meta">
                {[
                  actor.portfolioItem,
                  actor.blueprint
                    ? `${actor.blueprint.path} · ${actor.blueprint.commit.slice(0, 7)}`
                    : actor.machine,
                  actor.environment,
                  usage.data?.kind === "ok"
                    ? usage.data.usage.accounts.map((a) => a.account).join(", ")
                    : "",
                  new Date(timeline.start).toLocaleString(),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <div className="actor-page-controls">
              <div role="group" aria-label="Actor view" className="actor-segmented">
                {(["Timeline", "Sequence"] as const).map((v) => (
                  <Button
                    key={v}
                    variant={
                      (search.view === "sequence") === (v === "Sequence") ? "secondary" : "ghost"
                    }
                    aria-pressed={(search.view === "sequence") === (v === "Sequence")}
                    onClick={() =>
                      void navigate({ search: v === "Sequence" ? { view: "sequence" } : {} })
                    }
                  >
                    {v}
                  </Button>
                ))}
              </div>
              {thread?.url ? (
                <a className="task-link outline" href={thread.url} target="_blank" rel="noreferrer">
                  Open thread
                </a>
              ) : null}
            </div>
          </div>
          <ActorStats
            usage={input!.usage}
            duration={timeline.duration}
            passes={actorPasses(input!).length}
          />
          {removed ? <p className="muted">{removed}</p> : null}
          {search.view === "sequence" ? (
            removed ? (
              <EmptyState icon={SearchX} title="Events removed" description={removed} />
            ) : (
              <ActorSequence sequence={sequence} />
            )
          ) : (
            <ActorTimeline timeline={timeline} active={actor.status === "active"} />
          )}
        </>
      ) : null}
    </>
  );
}

function ActorStats({
  usage,
  duration,
  passes,
}: {
  usage: ActorUsageResponse | undefined;
  duration?: number;
  passes?: number;
}) {
  return (
    <div className="actor-tiles">
      <div>
        <small>Tokens</small>
        <strong
          title={
            usage
              ? Object.entries(usage.tokens)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")
              : undefined
          }
        >
          {usage ? usage.tokens.total.toLocaleString() : "—"}
        </strong>
      </div>
      <div>
        <small>Cost</small>
        {usage ? (
          <div>
            {usage.accounts.length
              ? usage.accounts.map((a) => (
                  <div key={a.account}>
                    {a.account} · {formatAmount(a.actual, a.unit)}
                  </div>
                ))
              : "—"}
          </div>
        ) : (
          <strong>—</strong>
        )}
      </div>
      <div>
        <small>Time</small>
        <strong>{duration === undefined ? "—" : durationLabel(duration)}</strong>
      </div>
      <div>
        <small>Passes</small>
        <strong>{passes ?? "—"}</strong>
      </div>
    </div>
  );
}
