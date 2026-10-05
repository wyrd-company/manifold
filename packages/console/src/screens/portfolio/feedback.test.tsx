// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import { StatusBar } from "./StatusBar.tsx";
import { ProblemsList } from "./ProblemsList.tsx";
const read: PortfolioResponse = {
  commit: null,
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
