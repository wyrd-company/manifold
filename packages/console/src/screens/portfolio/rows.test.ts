// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { portfolioRows, currentUsage, windowLabel } from "./rows.ts";
import { inputFinding } from "./findings.ts";
import type { PortfolioItem, PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
const item = (id: string, parent: string | null = null): PortfolioItem => ({
  id,
  parent,
  title: id,
  other: false,
  archived: false,
  projects: { github: [], t3code: [] },
  completedTasks: 0,
  activeTasks: 0,
  allocations: [],
});
test("nested rows hide archived items and place Other before unallocated", () => {
  const parent = { ...item("alpha"), unallocated: [] },
    child = item("beta", "alpha"),
    other = { ...item("alpha/other", "alpha"), other: true },
    archived = { ...item("gamma"), archived: true };
  const read: PortfolioResponse = {
    commit: null,
    pricing: { bundledCommit: "a".repeat(40), bundledModels: 1, overrides: 0, unpriced: [] },
    at: new Date(0).toISOString(),
    accounts: [],
    items: [parent, other, child, archived],
    unallocated: [],
    warnings: [],
  };
  expect(portfolioRows(read, []).map((r) => r.kind)).toEqual(["item", "unallocated"]);
  expect(
    portfolioRows(read, ["alpha"]).map((r) => (r.kind === "item" ? r.item.id : "unallocated")),
  ).toEqual(["alpha", "beta", "alpha/other", "unallocated", "unallocated"]);
});
test("current usage chooses the greatest share and no share for zero guarantees", () => {
  const a = {
    account: "acct-a",
    declared: true,
    guarantee: 50,
    amount: 100,
    actual: 20,
    outstanding: 0,
    available: 80,
    reservable: 80,
    lifetime: 20,
  };
  expect(
    currentUsage({
      ...item("alpha"),
      allocations: [
        a,
        { ...a, account: "acct-b", actual: 80 },
        { ...a, account: "acct-c", amount: 0 },
      ],
    }).map((a) => a.account),
  ).toEqual(["acct-b", "acct-a"]);
  expect(
    windowLabel({
      name: "acct-a",
      declared: true,
      capacity: { amount: 10, reset: "", every: { hours: 24 } },
    }),
  ).toBe("Daily");
});
test("guarantee findings mark only the named parent and account", () => {
  const finding = {
    file: "portfolio" as const,
    kind: "guarantee-limit" as const,
    location: "/items",
    message: "Over limit",
    details: { parent: null, account: "acct-a" },
  };
  expect(inputFinding([finding], item("alpha"), "acct-a", "guarantee")).toBe(finding);
  expect(inputFinding([finding], item("beta", "alpha"), "acct-a", "guarantee")).toBeUndefined();
  expect(inputFinding([finding], item("alpha"), "acct-b", "guarantee")).toBeUndefined();
  expect(inputFinding([finding], item("alpha"), "acct-a", "ceiling")).toBeUndefined();
});
test("nested field findings mark the child input without marking its ancestor", () => {
  const finding = {
    file: "portfolio" as const,
    kind: "invalid-portfolio" as const,
    location: "/items/alpha/items/beta/allocations/acct-a/ceiling",
    message: "Ceiling below guarantee",
  };
  expect(inputFinding([finding], item("beta", "alpha"), "acct-a", "ceiling")).toBe(finding);
  expect(inputFinding([finding], item("alpha"), "acct-a", "ceiling")).toBeUndefined();
});
test("Other field findings mark only the named parent's Other input", () => {
  const finding = {
    file: "portfolio" as const,
    kind: "invalid-portfolio" as const,
    location: "/items/alpha/items/other/allocations/acct-a/ceiling",
    message: "Ceiling below guarantee",
  };
  const other = (parent: string): PortfolioItem => ({
    ...item(parent + "/other", parent),
    other: true,
  });
  expect(inputFinding([finding], other("alpha"), "acct-a", "ceiling")).toBe(finding);
  expect(inputFinding([finding], other("beta"), "acct-a", "ceiling")).toBeUndefined();
});
