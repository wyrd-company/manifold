// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import { Button } from "../../ui/button.tsx";
import { Amount } from "./BudgetSourceCards.tsx";
export function ArchivedList({
  read,
  account,
  editing,
  onRestore,
}: {
  read: PortfolioResponse;
  account: string;
  editing: boolean;
  onRestore: (id: string) => void;
}) {
  const [shown, setShown] = useState(false),
    items = read.items.filter(
      (i) => i.archived && !read.items.find((p) => p.id === i.parent)?.archived,
    ),
    unit = read.accounts.find((a) => a.name === account)?.unit;
  if (!items.length) return null;
  return (
    <section className="portfolio-archived">
      <Button variant="ghost" onClick={() => setShown(!shown)}>
        Show archived ({items.length})
      </Button>
      {shown
        ? items.map((i) => (
            <div key={i.id}>
              <strong>{i.title}</strong>
              <span className="muted">
                {i.completedTasks ? `${i.completedTasks} completed` : "—"}
              </span>
              <Amount
                value={i.allocations.find((a) => a.account === account)?.lifetime ?? 0}
                unit={unit}
              />
              {!editing ? (
                <Button variant="outline" onClick={() => onRestore(i.id)}>
                  Restore
                </Button>
              ) : null}
            </div>
          ))
        : null}
    </section>
  );
}
