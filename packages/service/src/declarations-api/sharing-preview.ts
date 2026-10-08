// ---
// relationships:
//   implements: [declarations-api, portfolio-ledger]
// ---
import { portfolioData } from "@wyrd-company/manifold-shared";
import type { LedgerPortfolio, UsageAccount } from "@wyrd-company/manifold-shared";
import type { SharingPreview } from "@wyrd-company/manifold-shared/declarations-api";
import { sharingRule } from "../ledger/sharing-rule.ts";
export function sharingPreview(
  portfolio: LedgerPortfolio,
  accounts: Readonly<Record<string, UsageAccount>>,
): readonly SharingPreview[] {
  const items = [...portfolioData(portfolio).items.values()].filter((item) => !item.archived);
  return Object.entries(accounts)
    .filter(([, account]) => !account.archived)
    .map(([account]) => ({
      account,
      items: items.map((item) => {
        const answer = (waiting: readonly string[]) =>
          Number(
            sharingRule({
              portfolio,
              account,
              item: item.id,
              capacity: 1000000n,
              opensAt: 0,
              closesAt: 2,
              now: 1,
              usage: new Map(),
              unknown: 0n,
              total: 0n,
              waiting,
            }).reservable / 100n,
          ) / 100;
        return {
          item: item.id,
          alone: answer([item.id]),
          allWaiting: answer(items.map((item) => item.id)),
        };
      }),
    }));
}
