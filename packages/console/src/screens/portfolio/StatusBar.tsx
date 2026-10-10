// ---
// relationships:
//   implements: operator-console
// ---
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import type { LintDeclarationResponse as DeclarationLint } from "@wyrd-company/manifold-shared/declarations-api";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
export function StatusBar({
  read,
  account,
  lint,
  pending,
  editing,
  parents,
}: {
  read: PortfolioResponse;
  account: string;
  lint: DeclarationLint | undefined;
  pending: boolean;
  editing: boolean;
  parents: readonly (string | null)[];
}) {
  const limits = lint?.findings.filter((f) => f.kind === "guarantee-limit") ?? [];
  if (!editing && !limits.length) return null;
  if (!editing && !pending && !limits.length && !parents.length) return null;
  return (
    <div role="status" className={limits.length ? "error-alert" : "info-alert"}>
      {pending
        ? "Checking…"
        : limits.length
          ? limits.map((f) => <p key={f.location}>{f.message}</p>)
          : parents.map((parent) => {
              const sum = read.items
                .filter((i) => !i.archived && i.parent === parent)
                .reduce(
                  (s, i) => s + (i.allocations.find((a) => a.account === account)?.guarantee ?? 0),
                  0,
                );
              return (
                <p key={parent ?? "top"}>
                  {parent ?? "Top level"} · {formatPercent(100 - sum)} unallocated
                </p>
              );
            })}
      {editing ? (
        <p className="muted">Sharing preview: halfway through an idle window, nothing spent.</p>
      ) : null}
    </div>
  );
}
