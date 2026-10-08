// ---
// relationships:
//   verifies: [declarations-api, portfolio-ledger]
// ---
import { expect, test } from "vite-plus/test";
import { lintPortfolioDeclaration, lintUsageDeclaration } from "@wyrd-company/manifold-shared";
import { sharingPreview } from "./sharing-preview.ts";
test("preview uses the sharing rule's weights, ceilings and midpoint pacing", () => {
  const accounts = lintUsageDeclaration({
    prices: undefined,
    accounts:
      'accounts:\n  acct: {unit: usd, kind: api, capacity: {amount: 10, reset: "2026-01-01T00:00:00Z", every: {days: 1}}}\n',
  });
  if (!accounts.ok) throw Error("Invalid accounts");
  const preview = (extra = "", beta = "") => {
    const lint = lintPortfolioDeclaration({
      bindings: undefined,
      portfolio: `items:\n  alpha:\n    allocations:\n      acct: {guarantee: 60, ceiling: 70${extra}}\n  beta:\n    allocations:\n      acct: {guarantee: 20${beta}}\n`,
    });
    if (!lint.ok) throw Error("Invalid portfolio");
    return sharingPreview(lint.ledgerPortfolio, accounts.declaration.accounts)[0]!.items;
  };
  expect(preview()).toEqual([
    { item: "alpha", alone: 70, allWaiting: 66.66 },
    { item: "beta", alone: 40, allWaiting: 26.66 },
    { item: "other", alone: 20, allWaiting: 6.66 },
  ]);
  expect(preview(", weight: 3")).toContainEqual({ item: "beta", alone: 40, allWaiting: 24 });
  expect(preview("", ", pacing: {burst: 10}")).toContainEqual({
    item: "beta",
    alone: 20,
    allWaiting: 20,
  });
});
