// ---
// relationships:
//   verifies: portfolio-api
// ---
import { expect, test } from "vite-plus/test";
import { lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import { portfolioRead } from "./read.ts";
test("preserves declared account order, counts descendant tasks, and retains integer allocation remainder", () => {
  const lint = lintPortfolioDeclaration({
    portfolio:
      "items:\n  alpha:\n    allocations:\n      acct-z: { guarantee: 50 }\n    items:\n      beta:\n        allocations:\n          acct-z: { guarantee: 50 }\n  gamma:\n    allocations:\n      acct-z: { guarantee: 50 }\n",
    bindings: undefined,
  });
  if (!lint.ok) throw Error("fixture");
  const account = {
    unit: "usd" as const,
    kind: "api" as const,
    capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { days: 1 } },
  };
  const balance = {
    window: "w",
    allocation: 0,
    actual: 0,
    outstanding: 0,
    available: 0,
    reservable: 1,
  };
  const read = portfolioRead({
    portfolio: { commit: null, declaration: lint.declaration },
    lastUsedAt: {},
    pricing: { bundledCommit: "a".repeat(40), bundledModels: 1, overrides: 0, unpriced: [] },
    accounts: { "acct-z": account, "acct-a": account },
    balances: new Map(lint.declaration.items.map((i) => [i.id, new Map([["acct-z", balance]])])),
    totals: new Map([
      [
        "acct-z",
        {
          window: { window: "w", opensAt: 0, closesAt: 1000, capacity: 1 },
          used: 0,
          items: [{ item: "beta", lifetime: 10 }],
        },
      ],
    ]),
    warnings: [],
    snapshots: [
      {
        actorId: "task:parcel",
        machine: "sample",
        savedAt: 0,
        snapshot: {
          status: "active",
          value: "working",
          context: { manifold: { portfolioItem: "beta" } },
        },
      },
    ],
    ended: [
      {
        actorId: "task:parcel",
        machine: "sample",
        savedAt: 1,
        snapshot: {
          status: "done",
          value: "finished",
          context: { manifold: { portfolioItem: "beta" } },
        },
      },
    ],
    at: 0,
  });
  expect(read.items.find((i) => i.id === "alpha")?.completedTasks).toBe(1);
  expect(read.items.find((i) => i.id === "beta")?.completedTasks).toBe(1);
  expect(read.items.find((i) => i.id === "gamma")?.completedTasks).toBe(0);
  expect(read.accounts.map((a) => a.name)).toEqual(["acct-z", "acct-a"]);
  expect(read.items.find((i) => i.id === "alpha")?.activeTasks).toBe(1);
  expect(read.items.find((i) => i.id === "alpha")?.allocations[0]?.lifetime).toBe(10);
  expect(read.unallocated[0]).toEqual({ account: "acct-z", percent: 0, amount: 1 });
});
test("active accounts precede sorted allocated archived or undeclared names, with last reports and pricing", () => {
  const lint = lintPortfolioDeclaration({
    portfolio: "items: { alpha: { allocations: { acct-z: {}, constructor: {} } } }",
    bindings: undefined,
  });
  if (!lint.ok) throw Error("fixture");
  const account = {
    unit: "usd" as const,
    kind: "api" as const,
    capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { days: 1 } },
  };
  const pricing = { bundledCommit: "a".repeat(40), bundledModels: 1, overrides: 2, unpriced: [] };
  const read = portfolioRead({
    portfolio: { commit: null, declaration: lint.declaration },
    accounts: { "acct-z": { ...account, archived: true }, "acct-a": account },
    balances: new Map(),
    totals: new Map(),
    warnings: [],
    lastUsedAt: { "acct-z": 200 },
    pricing,
    snapshots: [],
    ended: [],
    at: 1000,
  });
  expect(read.accounts.map((account) => account.name)).toEqual(["acct-a", "acct-z", "constructor"]);
  expect(read.accounts[1]).toMatchObject({
    declared: true,
    archived: true,
    lastUsedAt: new Date(200).toISOString(),
  });
  expect(read.accounts[2]).toEqual({ name: "constructor", declared: false });
  expect(read.pricing).toEqual(pricing);
});
