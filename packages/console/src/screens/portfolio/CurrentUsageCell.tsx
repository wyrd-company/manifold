// ---
// relationships:
//   implements: operator-console
// ---
import type { PortfolioItem, PortfolioAccount } from "@wyrd-company/manifold-shared/portfolio-api";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
import { currentUsage, windowLabel } from "./rows.ts";
import { Amount, Meter } from "./BudgetSourceCards.tsx";
export function CurrentUsageCell({
  item,
  accounts,
  selected,
}: {
  item: PortfolioItem;
  accounts: readonly PortfolioAccount[];
  selected: string;
}) {
  const shares = currentUsage(item),
    chosen = shares[0] ?? item.allocations.find((a) => a.account === selected),
    account = accounts.find((a) => a.name === chosen?.account);
  if (!chosen) return <span className="muted">—</span>;
  const others = shares
    .slice(1)
    .map((a) => `${a.account}: ${formatPercent(a.share)}`)
    .join(", ");
  return (
    <div className="portfolio-current-usage" aria-description={others || undefined}>
      {shares[0] ? (
        <>
          <small>
            {chosen.account} · {windowLabel(account)}
          </small>
          <div>
            <Amount value={chosen.actual + chosen.outstanding} unit={account?.unit} />{" "}
            <span className="muted">{formatPercent(shares[0].share)}</span>
          </div>
          <Meter share={shares[0].share} />
          {shares[0].share >= 85 ? <small className="warning-text">Near limit</small> : null}
          {others ? (
            <small tabIndex={0} title={others}>
              +{shares.length - 1}
            </small>
          ) : null}
        </>
      ) : (
        <Amount value={chosen.actual + chosen.outstanding} unit={account?.unit} />
      )}
      <small className="muted">
        Can reserve <Amount value={chosen.reservable} unit={account?.unit} />
      </small>
    </div>
  );
}
