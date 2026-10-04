// ---
// relationships:
//   implements: portfolio-ledger
// ---
import type { LedgerPortfolio } from "./portfolio.js";
import { itemPath, portfolioData } from "./portfolio.js";
export type Entry = {
  kind: "credit" | "reserve" | "actual" | "move" | "settle";
  account: string;
  window_key: string | null;
  item: string | null;
  actor: string | null;
  amount: number | bigint;
};
export type Hold = {
  actor: string;
  account: string;
  item: string;
  net: bigint;
  outstanding: bigint;
};
export function foldHolds(entries: readonly Entry[]): Hold[] {
  const holds = new Map<string, Hold>();
  for (const entry of entries) {
    if (entry.kind === "credit") continue;
    const key = JSON.stringify([entry.actor, entry.account, entry.item]);
    const hold = holds.get(key) ?? {
      actor: entry.actor!,
      account: entry.account,
      item: entry.item!,
      net: 0n,
      outstanding: 0n,
    };
    const amount = BigInt(entry.amount);
    if (entry.kind === "actual") hold.outstanding = max(0n, hold.outstanding - amount);
    else {
      hold.net += amount;
      hold.outstanding = max(0n, hold.outstanding + amount);
    }
    holds.set(key, hold);
  }
  return [...holds.values()];
}
export const max = (a: bigint, b: bigint) => (a > b ? a : b);
export const min = (a: bigint, b: bigint) => (a < b ? a : b);
export const part = (amount: bigint, basisPoints: bigint) => (amount * basisPoints) / 10000n;
export function itemTotals(portfolio: LedgerPortfolio, direct: ReadonlyMap<string, bigint>) {
  const totals = new Map<string, bigint>();
  let unknown = 0n;
  let total = 0n;
  for (const [item, amount] of direct) {
    total += amount;
    if (!portfolioData(portfolio).items.has(item)) {
      unknown += amount;
      continue;
    }
    for (const ancestor of itemPath(portfolio, item))
      totals.set(ancestor, (totals.get(ancestor) ?? 0n) + amount);
  }
  return { totals, unknown, total };
}
