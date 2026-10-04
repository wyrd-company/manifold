// ---
// relationships:
//   implements: portfolio-ledger
// ---
import { allocationFor, itemPath, portfolioData } from "./portfolio.js";
import type { LedgerPortfolio } from "./portfolio.js";
import { max, min, part } from "./balance.js";
export function sharingRule(input: {
  portfolio: LedgerPortfolio;
  account: string;
  item: string;
  capacity: bigint;
  opensAt: number;
  closesAt: number;
  now: number;
  usage: ReadonlyMap<string, bigint>;
  unknown: bigint;
  total: bigint;
  waiting: readonly string[];
}) {
  const { portfolio, account, item, capacity, usage } = input;
  const data = portfolioData(portfolio);
  const guarantees = new Map<string, bigint>();
  const waiting = new Set<string>();
  for (const id of [...input.waiting, item]) {
    if (!data.items.has(id) || data.items.get(id)!.archived) continue;
    for (const ancestor of itemPath(portfolio, id)) waiting.add(ancestor);
  }
  function guarantee(id: string): bigint {
    const cached = guarantees.get(id);
    if (cached !== undefined) return cached;
    const node = data.items.get(id)!;
    const value = part(
      node.parent === null ? capacity : guarantee(node.parent),
      allocationFor(portfolio, account, id).guarantee,
    );
    guarantees.set(id, value);
    return value;
  }
  let parent: string | null = null;
  let parentGuarantee = capacity;
  let parentLimit = capacity;
  let answer = max(0n, capacity - input.total);
  for (const id of itemPath(portfolio, item)) {
    if (data.items.get(id)!.archived) return { allocation: guarantee(item), reservable: 0n };
    const siblings = data.children.get(parent) ?? [];
    const remainder = parentLimit - siblings.reduce((sum, child) => sum + guarantee(child), 0n);
    const borrowed = siblings.reduce(
      (sum, child) => sum + max(0n, (usage.get(child) ?? 0n) - guarantee(child)),
      parent === null ? input.unknown : 0n,
    );
    const free = max(0n, remainder - borrowed);
    const weights = siblings.reduce(
      (sum, child) =>
        sum + (waiting.has(child) ? allocationFor(portfolio, account, child).weight : 0n),
      0n,
    );
    const row = allocationFor(portfolio, account, id);
    const share = (free * row.weight) / weights;
    const g = guarantee(id);
    const used = usage.get(id) ?? 0n;
    const ceiling = part(parentLimit, row.ceiling);
    let room = max(0n, g - used) + min(share, max(0n, ceiling - max(g, used)));
    if (row.burst !== null) {
      const duration = BigInt(input.closesAt) - BigInt(input.opensAt);
      const elapsed = min(duration, max(0n, BigInt(input.now) - BigInt(input.opensAt)));
      const paced = (g * elapsed) / duration + part(parentGuarantee, row.burst);
      room = min(room, max(0n, paced - used));
    }
    answer = min(answer, room);
    parent = id;
    parentGuarantee = g;
    parentLimit = used + room;
  }
  return { allocation: guarantee(item), reservable: answer };
}
