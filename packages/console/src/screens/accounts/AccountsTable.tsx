// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { Pencil } from "lucide-react";
import type { PortfolioAccount } from "@wyrd-company/manifold-shared/portfolio-api";
import { formatAmount, formatPercent } from "@wyrd-company/manifold-shared/amounts";
import { Button } from "../../ui/button.tsx";
import { Meter } from "../portfolio/BudgetSourceCards.tsx";
import { resetLabel, windowLabel } from "../portfolio/rows.ts";
import type { AccountRow } from "./rows.ts";
export function reportAge(at: string, now: number) {
  return `${resetLabel(new Date(now).toISOString(), Date.parse(at))} ago`;
}
export function AccountsTable({
  rows,
  accounts,
  onEdit,
}: {
  rows: readonly AccountRow[];
  accounts: readonly PortfolioAccount[];
  onEdit: (row: AccountRow) => void;
}) {
  const [now] = useState(Date.now);
  return (
    <div className="accounts-table-wrap">
      <table className="accounts-table">
        <thead>
          <tr>
            {[
              ["Account", 17],
              ["Used by", 20],
              ["Budget", 23],
              ["Current use", 20],
              ["Last report", 15],
              ["", 5],
            ].map(([title, width]) => (
              <th key={title} style={{ width: `${width}%` }}>
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const account = accounts.find((account) => account.name === row.name);
            const window = account?.window;
            const share = window?.capacity ? (window.used / window.capacity) * 100 : 0;
            const budget = {
              name: row.name,
              declared: true,
              capacity: { ...row.capacity, amount: Math.round(row.capacity.amount * 1000000) },
            };
            const description = window
              ? `${formatAmount(window.used, "usd")} of ${formatAmount(window.capacity, "usd")}`
              : "";
            return (
              <tr key={row.name}>
                <td>
                  <strong>{row.name}</strong>
                  <small className="muted">{row.providers.join(", ") || "—"}</small>
                </td>
                <td>
                  {row.usage.length ? (
                    row.usage.map((entry) => (
                      <div
                        className="mono"
                        key={JSON.stringify([entry.environment, entry.provider, entry.instance])}
                        title={`${entry.environment}${entry.instance ? ` · ${entry.instance}` : ""}`}
                      >
                        {entry.environment}
                        {entry.instance ? ` · ${entry.instance}` : ""}
                      </div>
                    ))
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <div>
                    {formatAmount(budget.capacity!.amount, "usd")} · {windowLabel(budget)}
                  </div>
                  <small className="muted">
                    {row.kind === "api" ? "API budget" : "Subscription estimate"}
                  </small>
                  {window ? (
                    <small className="muted">
                      Resets in about {resetLabel(window.closesAt, now)}
                    </small>
                  ) : null}
                </td>
                <td>
                  {window ? (
                    <>
                      <div>
                        {windowLabel(budget)} · {formatPercent(share)}
                      </div>
                      <div aria-label={description}>
                        <Meter share={share} description={description} />
                      </div>
                    </>
                  ) : (
                    <span className="muted">No window yet</span>
                  )}
                </td>
                <td>
                  <span
                    className="account-report"
                    title={
                      account?.lastUsedAt
                        ? new Date(account.lastUsedAt).toLocaleString()
                        : undefined
                    }
                  >
                    <span
                      className={`account-report-dot ${account?.lastUsedAt && now - Date.parse(account.lastUsedAt) < 86400000 ? "success" : "idle"}`}
                    />
                    {account?.lastUsedAt ? reportAge(account.lastUsedAt, now) : "No report yet"}
                  </span>
                </td>
                <td>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${row.name}`}
                    onClick={() => onEdit(row)}
                  >
                    <Pencil size={14} />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
