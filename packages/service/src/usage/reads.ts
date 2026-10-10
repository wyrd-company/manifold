// ---
// relationships:
//   implements: usage-intake
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import type { LedgerConnection } from "../ledger/index.ts";
import type { UsagePricing } from "./types.ts";
import type { PriceTable } from "@wyrd-company/manifold-shared";
export function lastUsedAt(connection: LedgerConnection): Readonly<Record<string, number>> {
  const rows = connection.database
    .prepare(
      "SELECT CAST(account AS BLOB) AS account, MAX(used_at) AS at FROM usage_postings WHERE account IS NOT NULL GROUP BY account",
    )
    .all()
    .map(readUsagePostings) as { account: string; at: number }[];
  return Object.fromEntries(rows.map((row) => [row.account, row.at]));
}
export function pricing(connection: LedgerConnection, prices: PriceTable): UsagePricing {
  const grouped = (reason: "unpriced" | "unmetered") =>
    connection.database
      .prepare(
        "SELECT provider, CAST(model AS BLOB) AS model, COUNT(*) AS postings FROM usage_postings WHERE status = 'pending' AND reason = ? GROUP BY provider, model ORDER BY provider, model",
      )
      .all(reason)
      .map(readUsagePostingsModel) as UsagePricing[typeof reason];
  return {
    overrides: Object.keys(prices.models).length,
    unpriced: grouped("unpriced"),
    unmetered: grouped("unmetered"),
  };
}

function readUsagePostings<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    account: values["account"] === null ? null : storedText(values["account"]!),
  } as T;
}
function readUsagePostingsModel<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, model: values["model"] === null ? null : storedText(values["model"]!) } as T;
}
