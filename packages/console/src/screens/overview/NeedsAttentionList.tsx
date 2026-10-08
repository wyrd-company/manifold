// ---
// relationships:
//   implements: operator-console
// ---
import { Link } from "@tanstack/react-router";
import { Info, CircleAlert, Pause, CheckCircle } from "lucide-react";
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
import { buttonVariants } from "../../ui/button.tsx";
import { EmptyState } from "../EmptyContent.tsx";
import { elapsedLabel } from "./active-actors.ts";
import type { AttentionItem, AttentionTarget } from "./attention.ts";
function AttentionLink({ target }: { target: AttentionTarget }) {
  const className = buttonVariants({ variant: "outline", size: "sm" });
  switch (target.to) {
    case "task":
      return (
        <Link className={className} to="/board/task/$actorId" params={{ actorId: target.actorId }}>
          Open task
        </Link>
      );
    case "blueprint":
      return (
        <Link className={className} to="/blueprints/$" params={{ _splat: target.path }}>
          Open blueprint
        </Link>
      );
    case "actor":
      return (
        <Link className={className} to="/actors/$actorId" params={{ actorId: target.actorId }}>
          Open actor
        </Link>
      );
    case "board":
      return (
        <Link className={className} to="/board">
          Open board
        </Link>
      );
    case "environments":
      return (
        <Link className={className} to="/environments">
          Open environments
        </Link>
      );
  }
}
export function NeedsAttentionList({
  items,
  actors,
  now,
}: {
  items: readonly AttentionItem[];
  actors: readonly ActorSummary[] | undefined;
  now: number;
}) {
  return items.length === 0 ? (
    <EmptyState
      icon={CheckCircle}
      title="Nothing needs attention"
      description="Escalations, held actors, and paused environments appear here."
    />
  ) : (
    <ul className="overview-attention-list">
      {items.map((item) => {
        const title =
          item.kind === "escalation"
            ? item.escalation.title
            : item.kind === "held-actor"
              ? `${item.title ?? item.actorId} is held`
              : `${item.environment.name} is paused`;
        const detail =
          item.kind === "escalation"
            ? item.escalation.question.split("\n")[0]
            : item.kind === "held-actor"
              ? item.states.join(" · ")
              : `${item.environment.host} · ${item.environment.scheduledThreads} scheduled threads`;
        const time =
          item.kind === "escalation"
            ? item.escalation.raisedAt
            : item.kind === "held-actor"
              ? actors?.find((actor) => actor.actorId === item.actorId)?.savedAt
              : undefined;
        const Icon =
          item.kind === "escalation" ? Info : item.kind === "held-actor" ? CircleAlert : Pause;
        const key =
          item.kind === "escalation"
            ? item.escalation.id
            : item.kind === "held-actor"
              ? item.actorId
              : item.environment.name;
        return (
          <li key={`${item.kind}:${key}`}>
            <Icon
              size={16}
              className={
                item.kind === "escalation"
                  ? "overview-info-text"
                  : item.kind === "held-actor"
                    ? "error-text"
                    : "warning-text"
              }
              aria-hidden="true"
            />
            <div className="overview-attention-copy">
              <strong className="overview-attention-title">{title}</strong>
              <small className="muted">{detail}</small>
              {time !== undefined ? (
                <small className="muted">
                  {elapsedLabel(now - (typeof time === "string" ? Date.parse(time) : time))}
                </small>
              ) : null}
            </div>
            <AttentionLink target={item.target} />
          </li>
        );
      })}
    </ul>
  );
}
