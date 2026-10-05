// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import type { PortfolioResponse, PortfolioItem } from "@wyrd-company/manifold-shared/portfolio-api";
import { draftRead, changedGuaranteeParents } from "./preview.ts";
const allocation = (guarantee: number, amount: number) => ({
  account: "acct-a",
  declared: true,
  guarantee,
  amount,
  actual: 0,
  outstanding: 0,
  available: amount,
  reservable: amount,
  lifetime: 0,
});
const item = (
  id: string,
  parent: string | null,
  guarantee: number,
  amount: number,
  other = false,
): PortfolioItem => ({
  id,
  parent,
  title: id,
  other,
  archived: false,
  projects: { github: [], t3code: [] },
  activeTasks: 0,
  allocations: [allocation(guarantee, amount)],
});
const read: PortfolioResponse = {
  commit: null,
  at: new Date(0).toISOString(),
  warnings: [],
  accounts: [
    {
      name: "acct-a",
      declared: true,
      window: {
        key: "w",
        opensAt: new Date(0).toISOString(),
        closesAt: new Date(1000).toISOString(),
        capacity: 101,
        used: 0,
      },
    },
  ],
  items: [
    {
      ...item("alpha", null, 50, 50),
      unallocated: [{ account: "acct-a", percent: 40, amount: 20 }],
    },
    item("beta", "alpha", 40, 20),
    item("alpha/other", "alpha", 20, 10, true),
    item("other", null, 0, 0, true),
  ],
  unallocated: [{ account: "acct-a", percent: 50, amount: 51 }],
};
const text =
  "items:\n  alpha:\n    allocations:\n      acct-a: { guarantee: 70 }\n    items:\n      beta:\n        allocations:\n          acct-a: { guarantee: 40 }\n      other:\n        allocations:\n          acct-a: { guarantee: 20 }\n";
test("draft recomputes guarantee amounts and every remainder including Other and integer rounding", () => {
  const next = draftRead(read, text);
  expect(next.items.find((i) => i.id === "alpha")?.allocations[0]?.amount).toBe(70);
  expect(next.items.find((i) => i.id === "beta")?.allocations[0]?.amount).toBe(28);
  expect(next.unallocated).toEqual([{ account: "acct-a", percent: 30, amount: 31 }]);
  expect(next.items.find((i) => i.id === "alpha")?.unallocated).toEqual([
    { account: "acct-a", percent: 40, amount: 28 },
  ]);
  expect(next.items.find((i) => i.id === "alpha/other")?.allocations[0]?.amount).toBe(14);
  const over = draftRead(read, text.replace("guarantee: 70", "guarantee: 110"));
  expect(over.unallocated[0]?.percent).toBe(-10);
  expect(over.unallocated[0]?.amount).toBe(-10);
});
test("changed guarantee parents ignore untouched levels and ceiling-only edits", () => {
  const next = draftRead(read, text);
  expect(changedGuaranteeParents(read, next, "acct-a")).toEqual([null]);
  const nested = draftRead(read, text.replace("guarantee: 40", "guarantee: 30"));
  expect(changedGuaranteeParents(read, nested, "acct-a")).toEqual([null, "alpha"]);
  expect(
    changedGuaranteeParents(
      next,
      draftRead(read, text.replace("guarantee: 70", "guarantee: 70, ceiling: 90")),
      "acct-a",
    ),
  ).toEqual([]);
});
test("draft preview leaves the service read unchanged, including implicit Other", () => {
  const original = structuredClone(read);
  draftRead(read, text);
  expect(read).toEqual(original);
});
