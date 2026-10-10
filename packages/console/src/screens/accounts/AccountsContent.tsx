// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Plus } from "lucide-react";
import { fetchPortfolio } from "../../api/portfolio.ts";
import { fetchDeclarationSource } from "../../api/declarations.ts";
import { Button } from "../../ui/button.tsx";
import { ProblemsList } from "../portfolio/ProblemsList.tsx";
import { accountRows } from "./rows.ts";
import type { AccountRow } from "./rows.ts";
import { AccountsTable } from "./AccountsTable.tsx";
import { AccountDialog } from "./AccountDialog.tsx";
import { ArchivedAccounts } from "./ArchivedAccounts.tsx";
import { PricingCard } from "./PricingCard.tsx";
export function AccountsContent() {
  const query = useQuery({ queryKey: ["portfolio"], queryFn: fetchPortfolio, retry: false });
  const sourceQuery = useQuery({
    queryKey: ["declaration", "accounts.yml"],
    queryFn: () => fetchDeclarationSource("accounts.yml"),
    retry: false,
  });
  const [dialog, setDialog] = useState<{
    row?: AccountRow;
    source: { commit: string; text: string };
    rows: readonly AccountRow[];
    environments: readonly string[];
  }>();
  const [toast, setToast] = useState<string>();
  const source = sourceQuery.data?.kind === "ok" ? sourceQuery.data.body : undefined;
  const read = query.data?.kind === "ok" ? query.data.body : undefined;
  const invalid = source?.findings.some(
    (finding) =>
      finding.file === "accounts" && (finding.kind === "syntax" || finding.kind === "schema"),
  );
  const rows = source && !invalid ? accountRows(source.text) : [];
  const active = rows.filter((row) => !row.archived);
  const error =
    query.data?.kind === "failed"
      ? query.data.message
      : sourceQuery.data?.kind === "failed"
        ? sourceQuery.data.message
        : undefined;
  async function refresh() {
    await Promise.all([query.refetch(), sourceQuery.refetch()]);
  }
  function open(row?: AccountRow) {
    if (source) {
      setToast(undefined);
      setDialog({ ...(row ? { row } : {}), source, rows, environments: source.environments ?? [] });
    }
  }
  function saved(message: string) {
    setDialog(undefined);
    setToast(message);
  }
  return (
    <section className="accounts-screen">
      <div className="accounts-header">
        <div>
          <h2>Accounts and budget sources</h2>
          <p className="muted">The accounts usage is charged to, and the budget of each.</p>
        </div>
        <div className="accounts-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh accounts"
            onClick={() => void refresh()}
            disabled={query.isFetching || sourceQuery.isFetching}
          >
            <RefreshCw size={16} />
          </Button>
          {!invalid && !error ? (
            <Button disabled={!source || !read} onClick={() => open()}>
              <Plus size={14} />
              Add account
            </Button>
          ) : null}
        </div>
      </div>
      {toast ? (
        <p role="status" className="info-alert">
          {toast}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="error-alert">
          {error}
          <Button onClick={() => void refresh()}>Try again</Button>
        </div>
      ) : !source || !read ? (
        <p role="status">Loading accounts…</p>
      ) : (
        <>
          <ProblemsList lint={source} />
          {invalid ? (
            <div role="alert" className="error-alert">
              accounts.yml at {source.commit.slice(0, 7)} cannot be edited here. Fix it in the
              process repository.
            </div>
          ) : (
            <>
              {active.length ? (
                <AccountsTable rows={active} accounts={read.accounts} onEdit={open} />
              ) : (
                <div className="accounts-empty">
                  <h3>No accounts yet</h3>
                  <Button onClick={() => open()}>Add account</Button>
                </div>
              )}
              <ArchivedAccounts
                rows={rows.filter((row) => row.archived)}
                source={source}
                onSaved={saved}
              />
            </>
          )}
          <PricingCard pricing={read.pricing} />
        </>
      )}
      {dialog ? (
        <AccountDialog {...dialog} onClose={() => setDialog(undefined)} onSaved={saved} />
      ) : null}
    </section>
  );
}
