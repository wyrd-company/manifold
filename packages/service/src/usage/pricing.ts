// ---
// relationships:
//   implements: price-table
// ---
import type {
  PriceTable,
  UsagePriceEntry,
  UsageProvider,
  UsageTokens,
} from "@wyrd-company/manifold-shared";
import { bundledPriceTable } from "@wyrd-company/manifold-shared";
export function priceEntry(model: string | null, prices: PriceTable): UsagePriceEntry | undefined {
  if (model === null) return;
  for (const table of [prices, bundledPriceTable]) {
    const direct = table.models[model];
    if (direct) return direct;
    for (const entry of Object.values(table.models))
      if (entry.aliases?.includes(model)) return entry;
  }
}
function cumulative(
  tokens: UsageTokens,
  provider: UsageProvider,
  entry: UsagePriceEntry,
  speed: "standard" | "fast",
): bigint | undefined {
  const prices = entry[speed];
  if (!prices) return;
  const classes: [number, number | undefined][] = [
    [tokens.input, prices.input],
    [tokens.output, prices.output],
    [tokens.cacheRead, prices.cacheRead],
    [Math.max(0, tokens.cacheWrite - tokens.cacheWriteOneHour), prices.cacheWrite],
    [tokens.cacheWriteOneHour, prices.cacheWriteOneHour],
    [provider === "codex" ? 0 : tokens.reasoning, prices.reasoning ?? prices.output],
    [tokens.webSearchRequests * 1000000, prices.webSearchRequest],
  ];
  let sum = 0n;
  for (const [count, price] of classes) {
    if (!count) continue;
    if (price === undefined) return;
    sum += BigInt(count) * BigInt(Math.round(price * 1000000));
  }
  return (sum + 500000n) / 1000000n;
}
export function priceGrowth(
  base: UsageTokens,
  added: UsageTokens,
  provider: UsageProvider,
  entry: UsagePriceEntry | undefined,
  speed: "standard" | "fast",
): number | undefined {
  if (!entry) return;
  const total = { ...base };
  for (const key of Object.keys(base) as (keyof UsageTokens)[]) total[key] += added[key];
  const before = cumulative(base, provider, entry, speed),
    after = cumulative(total, provider, entry, speed);
  if (before === undefined || after === undefined) return;
  const amount = Number(after - before);
  if (!Number.isSafeInteger(amount))
    throw new Error("Usage amount exceeds the ledger integer range.");
  return amount;
}
