// ---
// relationships:
//   implements: usage-intake
// ---
import type { LedgerConnection } from "../ledger/index.ts";
import type { UsagePricing } from "./types.ts";
import type { PriceTable } from "@wyrd-company/manifold-shared";
export function lastUsedAt(connection: LedgerConnection): Readonly<Record<string, number>> {
  const rows = connection.database
    .prepare(
      "SELECT account, MAX(used_at) AS at FROM usage_postings WHERE account IS NOT NULL GROUP BY account",
    )
    .all() as { account: string; at: number }[];
  return Object.fromEntries(rows.map((row) => [row.account, row.at]));
}
export function pricing(connection: LedgerConnection, prices: PriceTable): UsagePricing {
  return {
    overrides: Object.keys(prices.models).length,
    unpriced: connection.database
      .prepare(
        "SELECT provider, model, COUNT(*) AS postings FROM usage_postings WHERE status = 'pending' AND reason = 'unpriced' GROUP BY provider, model ORDER BY provider, model",
      )
      .all() as UsagePricing["unpriced"],
  };
}
