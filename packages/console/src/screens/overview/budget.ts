// ---
// relationships:
//   implements: operator-console
// ---
import type {
  PortfolioAccount,
  PortfolioResponse,
} from "@wyrd-company/manifold-shared/portfolio-api";
import { currentUsage } from "../portfolio/rows.ts";
export interface Closest {
  readonly closest?: { readonly account: PortfolioAccount; readonly share: number };
  readonly count: number;
}
export function closestToLimit(accounts: readonly PortfolioAccount[]): Closest {
  let closest: Closest["closest"];
  const declared = accounts.filter((a) => a.declared);
  for (const account of declared) {
    if (!account.window || account.window.capacity <= 0) continue;
    const share = (account.window.used / account.window.capacity) * 100;
    if (!closest || share > closest.share) closest = { account, share };
  }
  return closest ? { closest, count: declared.length } : { count: declared.length };
}
export interface ItemBudget {
  readonly itemId: string;
  readonly title: string;
  readonly depth: number;
  readonly usage?: {
    readonly account: PortfolioAccount;
    readonly used: number;
    readonly amount: number;
    readonly share: number;
    readonly near: boolean;
  };
}
export function itemBudgets(read: PortfolioResponse): readonly ItemBudget[] {
  const items = new Map(read.items.map((item) => [item.id, item]));
  const accounts = new Map(read.accounts.map((account) => [account.name, account]));
  return read.items.flatMap((item) => {
    let depth = 0;
    let ancestor = item;
    while (ancestor.parent !== null) {
      ancestor = items.get(ancestor.parent)!;
      if (ancestor.archived) return [];
      depth++;
    }
    if (item.archived) return [];
    const allocation = currentUsage(item)[0];
    const account = accounts.get(allocation?.account ?? "");
    return [
      {
        itemId: item.id,
        title: item.title,
        depth,
        ...(allocation && account
          ? {
              usage: {
                account,
                used: allocation.actual + allocation.outstanding,
                amount: allocation.amount,
                share: allocation.share,
                near: allocation.share >= 85,
              },
            }
          : {}),
      },
    ];
  });
}
