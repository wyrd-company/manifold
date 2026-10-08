// ---
// relationships:
//   implements: [operator-console, usage-api]
// ---
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import type { UnownedEntry } from "@wyrd-company/manifold-shared/usage-api";
import { fetchUnownedUsage } from "../../api/usage.ts";
import { Button } from "../../ui/button.tsx";
import { Amount } from "./BudgetSourceCards.tsx";
import { resetLabel } from "./rows.ts";
import { MoveUsageDialog } from "./MoveUsageDialog.tsx";
export function UnownedUsage({ read, account }: { read: PortfolioResponse; account: string }) {
  const query = useQuery({
    queryKey: ["usage", "unowned"],
    queryFn: fetchUnownedUsage,
    retry: false,
  });
  const [all, setAll] = useState(false);
  const [entry, setEntry] = useState<UnownedEntry>();
  const [toast, setToast] = useState<string>();
  const [now] = useState(() => Date.now());
  const rows =
    query.data?.kind === "ok"
      ? query.data.body.unowned.filter(
          (e) => e.pending || e.usage.some((u) => u.account === account),
        )
      : [];
  return (
    <section className="unowned-usage">
      <h2>Unowned usage</h2>
      <p className="muted">
        Usage from threads no task owns. Move it to the item or task it was for.
      </p>
      {toast ? (
        <p role="status" className="info-alert">
          {toast}
        </p>
      ) : null}
      {query.data?.kind === "failed" ? (
        <div role="alert" className="error-alert">
          {query.data.message}
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </div>
      ) : query.isPending ? (
        <p className="muted">Loading usage…</p>
      ) : !rows.length ? (
        <p className="muted">No unowned usage.</p>
      ) : (
        <>
          <div className="unowned-usage-table">
            <table>
              <thead>
                <tr>
                  <th>Thread</th>
                  <th>Counts on</th>
                  <th>Amount</th>
                  <th>Last used</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(all ? rows : rows.slice(0, 20)).map((e) => {
                  const usage = e.usage.filter((u) => u.account === account);
                  return (
                    <tr key={e.actor}>
                      <td>
                        {e.kind === "session" ? "Unmapped session" : e.title || "Untitled thread"}
                        <small className="muted mono">
                          {e.environment} · {e.threadId ?? `${e.provider} · ${e.providerSessionId}`}
                        </small>
                      </td>
                      <td>
                        {[...new Set(usage.map((u) => u.item))]
                          .map((id) => read.items.find((i) => i.id === id)?.title ?? id)
                          .join(", ") || "—"}
                      </td>
                      <td>
                        <Amount
                          value={usage.reduce((n, u) => n + u.amount, 0)}
                          unit={read.accounts.find((a) => a.name === account)?.unit}
                        />
                        <small className="muted">
                          {usage.reduce((n, u) => n + u.calls, 0)} calls
                          {e.pending ? ` · ${e.pending} pending` : ""}
                        </small>
                      </td>
                      <td className="muted">
                        about{" "}
                        {resetLabel(
                          new Date(now + Math.max(0, now - Date.parse(e.lastUsedAt))).toISOString(),
                          now,
                        )}{" "}
                        ago
                      </td>
                      <td>
                        <Button variant="outline" size="sm" onClick={() => setEntry(e)}>
                          Move
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!all && rows.length > 20 ? (
            <Button variant="ghost" onClick={() => setAll(true)}>
              Show all ({rows.length})
            </Button>
          ) : null}
        </>
      )}
      {entry ? (
        <MoveUsageDialog
          entry={entry}
          read={read}
          onClose={() => setEntry(undefined)}
          onMoved={setToast}
        />
      ) : null}
    </section>
  );
}
