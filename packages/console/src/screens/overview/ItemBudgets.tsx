// ---
// relationships:
//   implements: operator-console
// ---
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import { formatAmount, formatPercent } from "@wyrd-company/manifold-shared/amounts";
import { Meter } from "../portfolio/BudgetSourceCards.tsx";
import { windowLabel } from "../portfolio/rows.ts";
import { itemBudgets } from "./budget.ts";
export function ItemBudgets({ read }: { read: PortfolioResponse | undefined }) {
  if (!read) return null;
  if (!read.accounts.length)
    return (
      <div role="status" className="info-alert">
        No accounts are declared. Declare them in accounts.yml.
      </div>
    );
  return (
    <div>
      {itemBudgets(read).map((item) => (
        <div className="overview-budget-row" key={item.itemId}>
          <strong style={{ paddingLeft: item.depth * 16 }}>{item.title}</strong>
          {item.usage ? (
            <>
              <small className="muted">
                {item.usage.account.name} · {windowLabel(item.usage.account)}
              </small>
              <div className="overview-budget-meter">
                <Meter share={item.usage.share} />
                {item.usage.near ? (
                  <span className="task-badge warning-text">Near limit</span>
                ) : null}
              </div>
              <small>
                {formatAmount(item.usage.used, item.usage.account.unit)} of{" "}
                {formatAmount(item.usage.amount, item.usage.account.unit)} ·{" "}
                {formatPercent(item.usage.share)}
              </small>
            </>
          ) : (
            <small className="muted">No allocation</small>
          )}
        </div>
      ))}
    </div>
  );
}
