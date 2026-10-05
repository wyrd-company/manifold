// ---
// relationships:
//   implements: operator-console
// ---
import type {
  PortfolioAccount,
  PortfolioItem,
  PortfolioResponse,
  PortfolioUnallocated,
} from "@wyrd-company/manifold-shared/portfolio-api";
export function windowLabel(account: PortfolioAccount | undefined) {
  const every = account?.capacity?.every;
  if (!every) return "";
  if ("days" in every)
    return every.days === 1 ? "Daily" : every.days === 7 ? "Weekly" : `Every ${every.days} days`;
  if ("hours" in every) return every.hours === 24 ? "Daily" : `Every ${every.hours} hours`;
  return every.months === 1 ? "Monthly" : `Every ${every.months} months`;
}
export function resetLabel(closesAt: string, now: number) {
  const ms = Date.parse(closesAt) - now;
  return ms < 3600000
    ? `${Math.max(1, Math.round(ms / 60000))} minutes`
    : ms < 172800000
      ? `${Math.round(ms / 3600000)} hours`
      : `${Math.round(ms / 86400000)} days`;
}
export type PortfolioRow =
  | { kind: "item"; item: PortfolioItem; depth: number }
  | {
      kind: "unallocated";
      parent: string | null;
      values: readonly PortfolioUnallocated[];
      depth: number;
    };
export function portfolioRows(
  read: PortfolioResponse,
  expanded: readonly string[],
  editing = false,
): PortfolioRow[] {
  const rows: PortfolioRow[] = [];
  function level(parent: string | null, depth: number) {
    const items = read.items
      .filter((i) => i.parent === parent && !i.archived)
      .sort((a, b) => Number(a.other) - Number(b.other));
    for (const item of items) {
      rows.push({ kind: "item", item, depth });
      if (item.unallocated && (editing || expanded.includes(item.id))) level(item.id, depth + 1);
    }
    rows.push({
      kind: "unallocated",
      parent,
      values:
        parent === null
          ? read.unallocated
          : (read.items.find((i) => i.id === parent)?.unallocated ?? []),
      depth,
    });
  }
  level(null, 0);
  return rows;
}
export function currentUsage(item: PortfolioItem) {
  return item.allocations
    .filter((a) => a.amount > 0)
    .map((a) => ({ ...a, share: ((a.actual + a.outstanding) / a.amount) * 100 }))
    .sort((a, b) => b.share - a.share);
}
