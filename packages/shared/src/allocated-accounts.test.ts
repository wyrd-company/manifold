// ---
// relationships:
//   verifies: [portfolio-declaration, accounts-declaration]
// ---
import { expect, test } from "vite-plus/test";
import { lintAllocatedAccounts } from "./allocated-accounts.ts";

const portfolio = "items: { alpha: { allocations: { acct: {}, acct-typo: {} } } }";
const accounts = `accounts:
  acct:
    unit: usd
    kind: api
    capacity: { amount: 10, reset: '2026-01-01T00:00:00Z', every: { days: 1 } }
`;
test("reports an undeclared allocation with its name, pointer, and warning severity", () => {
  expect(lintAllocatedAccounts({ portfolio, accounts })).toEqual([
    {
      file: "portfolio",
      location: "/items/alpha/allocations/acct-typo",
      kind: "account-undeclared",
      severity: "warning",
      message: expect.stringContaining('"acct-typo"'),
      details: { item: "alpha", account: "acct-typo" },
    },
  ]);
  expect(lintAllocatedAccounts({ portfolio, accounts })[0]?.message).toContain("accounts.yml");
});
test("checks every allocation in document order, including archived descendants and Other", () => {
  const text = `items:
  other: { allocations: { acct: {} } }
  alpha:
    archived: true
    allocations: { acct: {}, second: {} }
    items:
      other: { allocations: { acct: {} } }
      beta: { allocations: { acct: {} } }
`;
  expect(
    lintAllocatedAccounts({ portfolio: text, accounts: undefined }).map((warning) => [
      warning.location,
      warning.details,
    ]),
  ).toEqual([
    ["/items/other/allocations/acct", { item: "other", account: "acct" }],
    ["/items/alpha/allocations/acct", { item: "alpha", account: "acct" }],
    ["/items/alpha/allocations/second", { item: "alpha", account: "second" }],
    ["/items/alpha/items/other/allocations/acct", { item: "alpha/other", account: "acct" }],
    ["/items/alpha/items/beta/allocations/acct", { item: "beta", account: "acct" }],
  ]);
});
test.each([undefined, "", "{}"])("absent or empty portfolio %s has no warnings", (text) => {
  expect(lintAllocatedAccounts({ portfolio: text, accounts: undefined })).toEqual([]);
});
test.each([
  "[",
  "items: []",
  "items: { alpha: { allocations: { acct: { weight: 0 } } } }",
  "items: &cycle { alpha: { items: *cycle } }",
])("invalid portfolio %s suppresses cross-file warnings", (text) => {
  expect(lintAllocatedAccounts({ portfolio: text, accounts: undefined })).toEqual([]);
});
test.each(["[", "accounts: []", "accounts: { acct: { kind: api } }"])(
  "invalid accounts %s suppresses cross-file warnings",
  (text) => {
    expect(lintAllocatedAccounts({ portfolio, accounts: text })).toEqual([]);
  },
);
test("accepts declared accounts and warns for an undeclared inherited Object property name", () => {
  expect(
    lintAllocatedAccounts({ portfolio: portfolio.replace(", acct-typo: {}", ""), accounts }),
  ).toEqual([]);
  expect(
    lintAllocatedAccounts({
      portfolio: "items: { alpha: { allocations: { constructor: {} } } }",
      accounts: undefined,
    })[0]?.details.account,
  ).toBe("constructor");
});
