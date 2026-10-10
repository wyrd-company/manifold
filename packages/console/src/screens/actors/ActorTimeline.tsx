// ---
// relationships:
//   implements: operator-console
// ---
import { formatAmount } from "@wyrd-company/manifold-shared/amounts";
import type { ActorActual, ActorTokens } from "@wyrd-company/manifold-shared/actor-usage-api";
import type { ActorTimeline as Timeline } from "./actor-model.ts";
import { TimelineBar } from "./TimelineBar.tsx";
const unmeteredText = (calls: number) => `${calls} unmetered ${calls === 1 ? "call" : "calls"}`;
const unmeteredHelp = "The provider records no token counts for these calls, so they have no cost.";
export function ActorTokenLabel({
  tokens,
  unmetered,
  tokenClasses,
}: {
  tokens: number;
  unmetered: number;
  tokenClasses?: ActorTokens | undefined;
}) {
  const title = [
    tokenClasses
      ? Object.entries(tokenClasses)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : undefined,
    unmetered > 0 ? unmeteredHelp : undefined,
  ]
    .filter(Boolean)
    .join("\n");
  return (
    <span title={title || undefined}>
      {tokens === 0 && unmetered > 0
        ? unmeteredText(unmetered)
        : `${tokens.toLocaleString()} tokens`}
      {tokens > 0 && unmetered > 0 ? (
        <small className="muted">+ {unmeteredText(unmetered)}</small>
      ) : null}
    </span>
  );
}
export function ActorUsageLabel({
  tokens,
  unmetered,
  accounts,
  tokenClasses,
}: {
  tokens: number;
  unmetered: number;
  accounts: readonly ActorActual[];
  tokenClasses?: ActorTokens | undefined;
}) {
  return (
    <span className="actor-usage-label">
      <ActorTokenLabel tokens={tokens} unmetered={unmetered} tokenClasses={tokenClasses} />
      {accounts.map((a) => (
        <small key={a.account}>
          {a.account} · {formatAmount(a.actual, a.unit)}
        </small>
      ))}
      {!accounts.length && unmetered > 0 ? <small className="muted">—</small> : null}
    </span>
  );
}
export function ActorTimeline({ timeline, active }: { timeline: Timeline; active: boolean }) {
  return (
    <div className="actor-timeline-view">
      <table className="task-table actor-timeline-table">
        <thead>
          <tr>
            <th>State</th>
            <th>Timeline</th>
            <th>Exit</th>
            <th>Usage</th>
          </tr>
        </thead>
        <tbody>
          {timeline.rows.map((row) => (
            <tr key={row.visit}>
              <td>
                <span className="mono">{row.states.join(", ")}</span>
                {row.passes.map((n) => (
                  <small key={n}>pass {n}</small>
                ))}
                {row.commit ? <small className="mono">{row.commit.slice(0, 7)}</small> : null}
              </td>
              <td className="actor-axis">
                <TimelineBar timeline={timeline} rows={[row]} />
                {active ? <span className="actor-now" title="Now" /> : null}
              </td>
              <td className={`actor-exit tone-text-${row.tone}`}>{row.exit}</td>
              <td>
                <ActorUsageLabel
                  tokens={row.tokens}
                  unmetered={row.unmetered}
                  accounts={row.accounts}
                  tokenClasses={row.tokenClasses}
                />
              </td>
            </tr>
          ))}
          <tr className="actor-total">
            <td colSpan={3}>Total</td>
            <td>
              <ActorUsageLabel {...timeline.total} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
