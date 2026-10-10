// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import { PricingCard } from "./accounts/PricingCard.tsx";
import { ActorUsageLabel } from "./actors/ActorTimeline.tsx";
import { UnownedAmount, UnownedUsage } from "./portfolio/UnownedUsage.tsx";

const pricing = {
  bundledCommit: "a".repeat(40),
  bundledModels: 1,
  overrides: 0,
  unpriced: [],
};

test("actor usage distinguishes unmetered-only and mixed usage", () => {
  const classes = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, total: 0 };
  const only = renderToStaticMarkup(
    <ActorUsageLabel tokens={0} unmetered={2} accounts={[]} tokenClasses={classes} />,
  );
  expect(only).toContain("2 unmetered calls");
  expect(only).toContain('class="muted">—');
  expect(only).toContain(
    "The provider records no token counts for these calls, so they have no cost.",
  );

  const mixed = renderToStaticMarkup(
    <ActorUsageLabel
      tokens={12}
      unmetered={1}
      accounts={[]}
      tokenClasses={{ ...classes, total: 12 }}
    />,
  );
  expect(mixed).toContain("12 tokens");
  expect(mixed).toContain("+ 1 unmetered call");
});

test("pricing identifies models whose calls report no token counts", () => {
  const html = renderToStaticMarkup(
    <PricingCard
      pricing={{
        ...pricing,
        unmetered: [{ provider: "cursor", model: "sample-model", postings: 2 }],
      }}
    />,
  );
  expect(html).toContain("1 model in use report no token counts");
  expect(html).toContain("cursor · sample-model");
  expect(html).toContain("2 unmetered calls");
  expect(html).toContain("Their calls are counted on their tasks without tokens or cost.");
  const plural = renderToStaticMarkup(
    <PricingCard
      pricing={{
        ...pricing,
        unmetered: [
          { provider: "cursor", model: "sample-model", postings: 2 },
          { provider: "cursor", model: null, postings: 1 },
        ],
      }}
    />,
  );
  expect(plural).toContain("2 models in use report no token counts");
});

test("unowned usage displays metered, pending, and unmetered call counts", () => {
  const html = renderToStaticMarkup(
    <UnownedAmount amount={7} calls={3} pending={1} unmetered={2} unit="usd" />,
  );
  expect(html).toContain("3 calls");
  expect(html).toContain("1 pending");
  expect(html).toContain("2 unmetered");
});

test("unowned usage keeps an unmetered-only row for every selected account", () => {
  const entry = {
    actor: "thread:sample:one",
    kind: "thread" as const,
    environment: "sample",
    threadId: "one",
    lastUsedAt: new Date(0).toISOString(),
    pending: 0,
    unmetered: 1,
    usage: [],
  };
  const read: PortfolioResponse = {
    pricing: { ...pricing, unmetered: [] },
    commit: null,
    at: new Date(0).toISOString(),
    accounts: [],
    items: [
      {
        id: "other",
        parent: null,
        title: "Other",
        other: true,
        archived: false,
        projects: { github: [], t3code: [] },
        activeTasks: 0,
        completedTasks: 0,
        allocations: [],
      },
    ],
    unallocated: [],
    warnings: [],
  };
  const client = new QueryClient();
  client.setQueryData(["usage", "unowned"], { kind: "ok", body: { unowned: [entry] } });
  const html = renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <UnownedUsage read={read} account="acct-a" />
    </QueryClientProvider>,
  );
  expect(html).toContain("Untitled thread");
  expect(html).toContain("1 unmetered");
  expect(html).not.toContain("No unowned usage.");
});
