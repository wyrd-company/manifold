// ---
// relationships:
//   implements: portfolio
// ---
import type { CapacityAccount } from "./types.ts";
import type { LedgerWindows } from "../ledger/index.ts";
const earliest = Date.parse("0011-01-01T00:00:00.000Z");
const latest = Date.parse("9989-12-31T23:59:59.999Z");
export function capacityTimeSupported(at: number) {
  return Number.isSafeInteger(at) && at >= earliest && at <= latest;
}
export function capacityWindow(
  capacity: CapacityAccount["capacity"],
  at: number,
  neighbours: LedgerWindows,
) {
  const reset = Date.parse(capacity.reset);
  let opensAt: number;
  let closesAt: number;
  if ("months" in capacity.every) {
    const period = capacity.every.months;
    const origin = new Date(reset);
    const target = new Date(at);
    const months =
      (target.getUTCFullYear() - origin.getUTCFullYear()) * 12 +
      target.getUTCMonth() -
      origin.getUTCMonth();
    let k = Math.floor(months / period);
    const boundary = (index: number) => {
      const date = new Date(reset);
      date.setUTCMonth(origin.getUTCMonth() + index * period);
      return date.getTime();
    };
    if (boundary(k) > at) k--;
    opensAt = boundary(k);
    closesAt = boundary(k + 1);
  } else {
    const length =
      "hours" in capacity.every ? capacity.every.hours * 3600000 : capacity.every.days * 86400000;
    const k = Math.floor((at - reset) / length);
    opensAt = reset + k * length;
    closesAt = opensAt + length;
  }
  const open = Math.max(opensAt, neighbours.current?.closesAt ?? opensAt);
  const close = Math.min(closesAt, neighbours.next?.opensAt ?? closesAt);
  const declaredAmount = Math.round(capacity.amount * 1000000);
  const scaled = (BigInt(declaredAmount) * BigInt(close - open)) / BigInt(closesAt - opensAt);
  return {
    window: new Date(open).toISOString(),
    opensAt: open,
    closesAt: close,
    amount: Number(scaled > 0n ? scaled : 1n),
  };
}
