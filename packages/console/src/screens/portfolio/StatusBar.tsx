// ---
// relationships:
//   implements: operator-console
// ---
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import type { DeclarationLint } from "../../api/portfolio-declarations-stand-in.ts";
import { formatPercent } from "@wyrd-company/manifold-shared/amounts";
export function StatusBar({
  read,
  account,
  lint,
  pending,
  editing,
}: {
  read: PortfolioResponse;
  account: string;
  lint: DeclarationLint | undefined;
  pending: boolean;
  editing: boolean;
}) {
  const limits = lint?.findings.filter((f) => f.kind === "guarantee-limit") ?? [];
  if (!editing && !limits.length) return null;
  const parents = [null, ...read.items.filter((i) => i.unallocated).map((i) => i.id)];
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
    </div>
  );
}
