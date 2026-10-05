// ---
// relationships:
//   implements: portfolio-api
// ---
import type {
  PortfolioResponse,
  PortfolioAccount,
  PortfolioWarning,
} from "@wyrd-company/manifold-shared/portfolio-api";
import type { PortfolioInForce } from "../portfolio/index.ts";
import type { UsageAccount } from "@wyrd-company/manifold-shared";
import type { LedgerBalance, LedgerTotals } from "../ledger/index.ts";
import type { StoredSnapshot } from "../store/index.ts";
export function portfolioRead(input: {
  portfolio: PortfolioInForce;
  accounts: Readonly<Record<string, UsageAccount>>;
  balances: ReadonlyMap<string, ReadonlyMap<string, LedgerBalance>>;
  totals: ReadonlyMap<string, LedgerTotals>;
  warnings: readonly PortfolioWarning[];
  snapshots: readonly StoredSnapshot[];
  at: number;
}): PortfolioResponse {
  const declaration = input.portfolio.declaration;
  const names = [
    ...Object.keys(input.accounts),
    ...[
      ...new Set(
        declaration.ledger.allocations
          .map((a) => a.account)
          .filter((name) => !Object.hasOwn(input.accounts, name)),
      ),
    ].sort(),
  ];
  const accounts: PortfolioAccount[] = names.map((name) => {
    const a = input.accounts[name],
      total = input.totals.get(name);
    return {
      name,
      declared: !!a,
      ...(a
        ? {
            unit: a.unit,
            kind: a.kind,
            capacity: { ...a.capacity, amount: Math.round(a.capacity.amount * 1000000) },
          }
        : {}),
      ...(total?.window && total.window.closesAt > input.at
        ? {
            window: {
              key: total.window.window,
              opensAt: new Date(total.window.opensAt).toISOString(),
              closesAt: new Date(total.window.closesAt).toISOString(),
              capacity: total.window.capacity,
              used: total.used,
            },
          }
        : {}),
    };
  });
  const lifetime = (id: string, account: string): number => {
    const direct = input.totals.get(account)?.items.find((i) => i.item === id)?.lifetime ?? 0;
    return (
      direct +
      declaration.items
        .filter((i) => i.parent === id)
        .reduce((sum, i) => sum + lifetime(i.id, account), 0)
    );
  };
  const unallocated = (parent: string | null) =>
    names.map((account) => {
      const children = declaration.items.filter((i) => i.parent === parent && !i.archived);
      const percent = Number(
        (
          100 -
          children.reduce(
            (sum, i) =>
              sum +
              (declaration.ledger.allocations.find((a) => a.item === i.id && a.account === account)
                ?.guarantee ?? 0),
            0,
          )
        ).toFixed(2),
      );
      const amount =
        parent === null
          ? (input.totals.get(account)?.window?.capacity ?? 0)
          : (input.balances.get(parent)?.get(account)?.allocation ?? 0);
      return {
        account,
        percent,
        amount:
          amount -
          children.reduce(
            (sum, item) => sum + (input.balances.get(item.id)?.get(account)?.allocation ?? 0),
            0,
          ),
      };
    });
  function under(id: string, parent: string): boolean {
    if (id === parent) return true;
    const item = declaration.items.find((item) => item.id === id);
    return item?.parent ? under(item.parent, parent) : false;
  }
  const items = declaration.items.map((item) => ({
    ...item,
    projects: {
      github: declaration.githubProjects
        .filter((p) => !p.archived && p.item === item.id)
        .map((p) => ({ binding: p.name, owner: p.owner, number: p.number })),
      t3code: [
        ...declaration.t3codeProjects
          .filter((p) => !p.archived && p.item === item.id)
          .map((p) => ({
            binding: p.name,
            environment: p.environment,
            project: p.project,
            via: "binding" as const,
          })),
        ...declaration.githubProjects
          .filter((p) => !p.archived && p.item === item.id)
          .flatMap((p) =>
            p.t3codeProjects.map((project) => ({
              environment: p.environment,
              project,
              via: "association" as const,
            })),
          ),
      ],
    },
    activeTasks: input.snapshots.filter(
      (s) =>
        s.snapshot.status === "active" &&
        under(
          (s.snapshot["context"] as { manifold?: { portfolioItem?: string } } | undefined)?.manifold
            ?.portfolioItem ?? "",
          item.id,
        ),
    ).length,
    allocations: names.map((account) => {
      const row = declaration.ledger.allocations.find(
        (a) => a.item === item.id && a.account === account,
      );
      const b = input.balances.get(item.id)?.get(account);
      return {
        account,
        declared: !!row,
        guarantee: row?.guarantee ?? 0,
        ...(row?.ceiling !== undefined ? { ceiling: row.ceiling } : {}),
        ...(row?.weight !== undefined ? { weight: row.weight } : {}),
        ...(row?.pacing ? { pacing: row.pacing } : {}),
        amount: b?.allocation ?? 0,
        actual: b?.actual ?? 0,
        outstanding: b?.outstanding ?? 0,
        available: b?.available ?? 0,
        reservable: b?.reservable ?? 0,
        lifetime: lifetime(item.id, account),
      };
    }),
    ...(declaration.items.some((i) => i.parent === item.id)
      ? { unallocated: unallocated(item.id) }
      : {}),
  }));
  return {
    commit: input.portfolio.commit,
    at: new Date(input.at).toISOString(),
    accounts,
    items,
    unallocated: unallocated(null),
    warnings: input.warnings,
  };
}
