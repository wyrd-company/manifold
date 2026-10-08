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
