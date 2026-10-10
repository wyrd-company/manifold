// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { formatAmount, formatAmountExact, formatPercent } from "./amounts.ts";
test.each([
  [1000000, "$1.00"],
  [17700, "$0.0177"],
  [500000, "$0.50"],
  [1234, "$0.0012"],
  [40, "<$0.0001"],
  [999995, "$1.00"],
  [1234567890, "$1,234.57"],
  [-2500000, "−$2.50"],
  [0, "$0.00"],
  [Number.MAX_SAFE_INTEGER, "$9,007,199,254.74"],
])("formats %s USD as %s", (amount, text) =>
  expect(formatAmount(amount as number, "usd")).toBe(text),
);
test("formats exact values, unknown units, signed variance and percentages", () => {
  expect(formatAmount(2500000, "usd", { signed: true })).toBe("+$2.50");
  expect(formatAmountExact(17734, "usd")).toBe("$0.017734");
  expect(formatAmount(17734, undefined)).toBe("17,734");
  expect(formatPercent(33.33)).toBe("33.33%");
  expect(formatPercent(50)).toBe("50%");
});
