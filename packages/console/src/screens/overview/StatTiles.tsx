// ---
// relationships:
//   implements: operator-console
// ---
import type { ReactNode } from "react";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
import { Meter } from "../portfolio/BudgetSourceCards.tsx";
import { windowLabel } from "../portfolio/rows.ts";
import { closestToLimit } from "./budget.ts";
import type { ActiveActorRow } from "./active-actors.ts";
import type { AttentionItem } from "./attention.ts";
import type { EnvironmentSummary } from "./environments.ts";
function Tile({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="overview-stat">
      <h2>{label}</h2>
      <div className="overview-stat-value">{value}</div>
      {children}
    </section>
  );
}
export function StatTiles({
  rows,
  attention,
  portfolio,
  environments,
}: {
  rows: readonly ActiveActorRow[] | undefined;
  attention: readonly AttentionItem[] | undefined;
  portfolio: PortfolioResponse | undefined;
  environments: readonly EnvironmentSummary[] | undefined;
}) {
  const held = rows?.filter((row) => row.status === "held").length ?? 0;
  const closest = portfolio ? closestToLimit(portfolio.accounts) : undefined;
  const paused = environments?.filter((e) => e.status === "paused").length ?? 0;
  const kinds = (
    [
      ["escalation", "escalation"],
      ["held-actor", "held"],
      ["paused-environment", "paused"],
    ] as const
  ).flatMap(([kind, label]) => {
    const count = (attention ?? []).filter((item) => item.kind === kind).length;
    return count ? [`${count} ${label}${kind === "escalation" && count !== 1 ? "s" : ""}`] : [];
  });
  return (
    <div className="overview-stats">
      <Tile label="Active actors" value={rows?.length ?? "—"}>
        <small className={held ? "error-text" : "muted"}>
          {rows === undefined ? "Not available" : held ? `${held} held` : "None held"}
        </small>
      </Tile>
      <Tile label="Needs attention" value={attention?.length ?? "—"}>
        <small className="muted">
          {attention === undefined ? "Not available" : kinds.join(" · ") || "Nothing waits on you"}
        </small>
      </Tile>
      <Tile
        label="Closest to limit"
        value={closest?.closest ? formatPercent(closest.closest.share) : "—"}
      >
        {closest?.closest ? (
          <>
            <small>
              {closest.closest.account.name} · {windowLabel(closest.closest.account)}
            </small>
            <Meter share={closest.closest.share} />
            <small className="muted">of {closest.count} accounts</small>
          </>
        ) : (
          <small className="muted">
            {!closest
              ? "Not available"
              : closest.count
                ? "No window yet"
                : "No accounts are declared"}
          </small>
        )}
      </Tile>
      <Tile
        label="Environments"
        value={
          environments
            ? `${environments.filter((e) => e.status === "connected").length} of ${environments.length} connected`
            : "—"
        }
      >
        <small className={paused ? "warning-text" : "muted"}>
          {!environments ? "Not available" : paused ? `${paused} paused` : "None paused"}
        </small>
      </Tile>
    </div>
  );
}
