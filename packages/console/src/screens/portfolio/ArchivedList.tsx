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
  onResolve,
}: {
  read: PortfolioResponse;
  account: string;
  editing: boolean;
  onRestore: (id: string) => void;
  onResolve: (id: string) => void;
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
              {(() => {
                function under(id: string): boolean {
                  const row = read.items.find((r) => r.id === id);
                  return id === i.id || (!!row?.parent && under(row.parent));
                }
                const count = read.items
                  .filter((r) => under(r.id))
                  .reduce(
                    (n, r) => n + r.projects.t3code.filter((p) => p.via === "created").length,
                    0,
                  );
                return count ? (
                  <>
                    <span className="warning-text">{count} projects to resolve</span>
                    <Button variant="outline" disabled={editing} onClick={() => onResolve(i.id)}>
                      Choose project moves
                    </Button>
                  </>
                ) : null;
              })()}
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
