// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import type { PortfolioAccount } from "@wyrd-company/manifold-shared/portfolio-api";
import { formatAmount, formatAmountExact } from "@wyrd-company/manifold-shared/amounts";
import { windowLabel, resetLabel } from "./rows.ts";
export function Amount({
  value,
  unit,
  signed = false,
}: {
  value: number;
  unit: string | undefined;
  signed?: boolean;
}) {
  return (
    <span title={formatAmountExact(value, unit)}>{formatAmount(value, unit, { signed })}</span>
  );
}
export function Meter({ share }: { share: number }) {
  return (
    <div
      className={`portfolio-meter ${share >= 85 ? "warning" : ""}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.max(0, share))}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, share))}%` }} />
    </div>
  );
}
export function BudgetSourceCards({ accounts }: { accounts: readonly PortfolioAccount[] }) {
  const [now] = useState(() => Date.now());
  return (
    <div className="portfolio-budget-cards">
      {accounts.map((a) => (
        <section className="portfolio-budget-card" key={a.name}>
          <header>
            <strong>{a.name}</strong>
            <span className={`task-badge ${!a.declared ? "warning-text" : ""}`}>
              {!a.declared ? "Not declared" : a.kind === "api" ? "API" : "Subscription"}
            </span>
          </header>
          {!a.declared ? (
            <p className="muted">Declare it in accounts.yml</p>
          ) : a.window ? (
            <>
              <small>{windowLabel(a)}</small>
              <Meter share={a.window.capacity ? (a.window.used / a.window.capacity) * 100 : 0} />
              <p>
                <Amount value={a.window.used} unit={a.unit} /> <span className="muted">of</span>{" "}
                <Amount value={a.window.capacity} unit={a.unit} />
              </p>
              <p className="portfolio-reset muted">
                Resets in about {resetLabel(a.window.closesAt, now)}
              </p>
            </>
          ) : (
            <p className="muted">No window yet</p>
          )}
        </section>
      ))}
    </div>
  );
}
