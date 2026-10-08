// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import { BudgetSourceCards } from "./BudgetSourceCards.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { ProblemsList } from "./ProblemsList.tsx";
const read: PortfolioResponse = {
  commit: null,
  pricing: { bundledCommit: "a".repeat(40), bundledModels: 1, overrides: 0, unpriced: [] },
  at: new Date(0).toISOString(),
  accounts: [],
  items: [],
  unallocated: [],
  warnings: [],
};
const empty = { findings: [], warnings: [] };
test("status has no empty region when unchanged or ceiling-only edits settle", () => {
  const props = { read, account: "acct-a", lint: empty, editing: true, parents: [] };
  expect(renderToStaticMarkup(<StatusBar {...props} pending={false} />)).toBe("");
  expect(renderToStaticMarkup(<StatusBar {...props} pending={true} />)).toContain("Checking…");
  expect(renderToStaticMarkup(<StatusBar {...props} parents={[null]} pending={false} />)).toContain(
    "Top level",
  );
  expect(renderToStaticMarkup(<StatusBar {...props} editing={false} pending={false} />)).toBe("");
});
test("problems list has no empty container and retains findings or warnings", () => {
  expect(renderToStaticMarkup(<ProblemsList lint={undefined} />)).toBe("");
  expect(renderToStaticMarkup(<ProblemsList lint={empty} />)).toBe("");
  const finding = {
    file: "portfolio" as const,
    location: "/items/alpha",
    kind: "guarantee-limit" as const,
    message: "Sample finding",
  };
  expect(
    renderToStaticMarkup(<ProblemsList lint={{ findings: [finding], warnings: [] }} />),
  ).toContain("Sample finding");
  expect(
    renderToStaticMarkup(
      <ProblemsList
        lint={{
          findings: [],
          warnings: [
            { ...finding, file: "portfolio", kind: "undeclared-account", severity: "warning" },
          ],
        }}
      />,
    ),
  ).toContain("Sample finding");
});

test("archived budget cards direct restoration without a meter", () => {
  const html = renderToStaticMarkup(
    <BudgetSourceCards
      accounts={[
        {
          name: "acct-a",
          declared: true,
          archived: true,
          kind: "api",
          unit: "usd",
          window: {
            key: "sample-window",
            opensAt: new Date(0).toISOString(),
            closesAt: new Date(1000).toISOString(),
            capacity: 100,
            used: 25,
          },
        },
      ]}
    />,
  );
  expect(html).toContain("Archived");
  expect(html).toContain("warning-text");
  expect(html).toContain("Restore it in Settings, Accounts");
  expect(html).not.toContain('role="meter"');
});
