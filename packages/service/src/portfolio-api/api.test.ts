// ---
// relationships:
//   verifies: portfolio-api
// ---
import { expect, test } from "vite-plus/test";
import { memoryRevision, lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import { mountPortfolioApi } from "./index.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";
import { isPortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
const text =
  "items:\n  alpha:\n    allocations:\n      acct-a: { guarantee: 50 }\n      acct-c: { guarantee: 0 }\n  beta:\n    allocations:\n      acct-a: { guarantee: 50 }\n";
test("portfolio read uses balances and updates warnings when accounts alone change", async () => {
  const result = lintPortfolioDeclaration({
    portfolio: text,
    bindings:
      "t3codeProjects:\n  workspace: {environment: local, project: bound, item: alpha}\ngithubProjects:\n  board: {owner: sample, number: 1, environment: local, item: alpha, t3codeProjects: [associated]}\n",
  });
  if (!result.ok) throw Error("fixture");
  const h = await consoleHost();
  let declared = false;
  let at = 0;
  const account = {
    unit: "usd" as const,
    kind: "api" as const,
    capacity: { amount: 10, reset: "2026-01-01T00:00:00Z", every: { days: 1 } },
  };
  const options = {
    portfolio: {
      createdProjects: () => [
        {
          environment: "local",
          project: "created",
          actorId: "a1",
          createdItem: "alpha",
          resolution: { item: "alpha", via: "created" as const, actorId: "a1" },
          usageItem: "alpha",
          unresolved: false,
          retirable: false,
        },
      ],
      current: () => ({ commit: "a".repeat(40), declaration: result.declaration }),
      ledger: {
        balance: ({ item, account }: { item: string; account: string }) => ({
          window: "w",
          allocation: item === "other" || account === "acct-c" ? 0 : 5000000,
          actual: 17700,
          outstanding: 0,
          available: 4982300,
          reservable: 4982300,
        }),
        windowAt: () => ({
          current: { window: "w", opensAt: 0, closesAt: 86400000, capacity: 10000000 },
          next: null,
        }),
        totals: () => ({
          window: { window: "w", opensAt: 0, closesAt: 86400000, capacity: 10000000 },
          used: 17700,
          items: [{ item: "alpha", lifetime: 17700 }],
        }),
      },
    },
    lastUsedAt: () => ({}),
    pricing: () => ({ overrides: 0, unpriced: [] }),
    accounts: () => (declared ? { "acct-a": account, "acct-c": account } : { "acct-a": account }),
    processRepository: {
      revisionAt: async () => {
        await Promise.resolve();
        at = 1000;
        return memoryRevision("a".repeat(40), { "portfolio.yml": text });
      },
    },
    store: { activeSnapshots: () => [], endedSnapshots: () => [] },
    now: () => at,
    log: () => {},
  };
  try {
    mountPortfolioApi(h.host, options);
    const read = async () => {
      const response = await fetch(h.url + "/api/portfolio");
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body: unknown = await response.json();
      expect(isPortfolioResponse(body)).toBe(true);
      if (!isPortfolioResponse(body)) throw Error("invalid");
      return body;
    };
    const first = await read();
    expect(first.at).toBe(new Date(1000).toISOString());
    expect(
      first.items.find((i) => i.id === "alpha")?.projects.t3code.map((p) => [p.via, p.project]),
    ).toEqual([
      ["binding", "bound"],
      ["association", "associated"],
      ["created", "created"],
    ]);
    expect(first.warnings.map((w) => w.details?.["account"])).toEqual(["acct-c"]);
    expect(first.items.find((i) => i.id === "alpha")?.allocations[0]).toMatchObject({
      actual: 17700,
      lifetime: 17700,
    });
    declared = true;
    expect((await read()).warnings).toEqual([]);
    declared = false;
    expect((await read()).warnings).toHaveLength(1);
    expect((await fetch(h.url + "/api/portfolio", { method: "POST" })).status).toBe(405);
    expect((await fetch(h.url + "/api/portfolio/missing")).status).toBe(404);
  } finally {
    await h.close();
  }
});
test("read failure answers JSON and logs the path", async () => {
  const h = await consoleHost();
  const logs: unknown[] = [];
  try {
    mountPortfolioApi(h.host, {
      portfolio: {
        createdProjects: () => [],
        current: () => {
          throw Error("synthetic failure");
        },
        ledger: {
          balance: () => {
            throw Error("unused");
          },
          windowAt: () => {
            throw Error("unused");
          },
          totals: () => {
            throw Error("unused");
          },
        },
      },
      lastUsedAt: () => ({}),
      pricing: () => ({ overrides: 0, unpriced: [] }),
      accounts: () => ({}),
      processRepository: { revisionAt: async () => undefined },
      store: { activeSnapshots: () => [], endedSnapshots: () => [] },
      log: (e) => logs.push(e),
    });
    const response = await fetch(h.url + "/api/portfolio");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal", message: "Portfolio read failed." });
    expect(logs).toEqual([{ level: "error", path: "/api/portfolio", error: "synthetic failure" }]);
  } finally {
    await h.close();
  }
});
