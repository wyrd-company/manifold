// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { renderToStaticMarkup } from "react-dom/server";
import { StatTiles } from "./StatTiles.tsx";
test("unavailable reads display dashes rather than an empty attention count", () => {
  const html = renderToStaticMarkup(
    <StatTiles
      rows={undefined}
      attention={undefined}
      portfolio={undefined}
      environments={undefined}
    />,
  );
  expect(html.match(/Not available/g)).toHaveLength(4);
  expect(html.match(/overview-stat-value">—/g)).toHaveLength(4);
});
test("successful empty reads show zero counts and no declared account", () => {
  const html = renderToStaticMarkup(
    <StatTiles
      rows={[]}
      attention={[]}
      portfolio={{
        pricing: {
          bundledCommit: "a".repeat(40),
          bundledModels: 1,
          overrides: 0,
          unpriced: [],
          unmetered: [],
        },
        commit: null,
        at: new Date(0).toISOString(),
        accounts: [],
        items: [],
        unallocated: [],
        warnings: [],
      }}
      environments={[]}
    />,
  );
  expect(html).toContain("Nothing waits on you");
  expect(html).toContain("No accounts are declared");
  expect(html).toContain("0 of 0 connected");
  expect(html).not.toContain("Not available");
});

test("pause and connection counts are independent of the summary status", () => {
  const environments = [
    {
      name: "north",
      host: "example.test",
      url: "https://example.test/north",
      status: "paused" as const,
      connection: "connected" as const,
      paused: true,
      disconnected: false,
      activeThreads: 0,
      scheduledThreads: 0,
    },
    {
      name: "south",
      host: "example.test",
      url: "https://example.test/south",
      status: "disconnected" as const,
      connection: "disconnected" as const,
      paused: true,
      disconnected: true,
      activeThreads: null,
      scheduledThreads: 2,
    },
  ];
  const html = renderToStaticMarkup(
    <StatTiles rows={[]} attention={[]} portfolio={undefined} environments={environments} />,
  );
  expect(html).toContain("1 of 2 connected");
  expect(html).toContain("2 paused");
});
