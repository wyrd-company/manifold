// ---
// relationships:
//   verifies: portfolio
// ---
import { expect, test } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openStore } from "../store/index.ts";
import { ledgerMigrationSteps } from "../ledger/index.ts";
import { openPortfolio, portfolioMigrationSteps } from "./index.ts";
test("created ownership preserves provenance, binding precedence and Other attribution", async () => {
  const store = openStore({ path: ":memory:" });
  try {
    store.connection.migrate("ledger", ledgerMigrationSteps);
    store.connection.migrate("portfolio", portfolioMigrationSteps);
    const records = [
      { environment: "local", projectId: "p1", actorId: "a1", item: "beta", retirable: false },
    ];
    const portfolio = openPortfolio({
      connection: store.connection,
      createdProject: () => records[0],
      createdProjects: () => records,
    });
    const apply = (text: string, bindings = "") =>
      portfolio.apply(
        memoryRevision("a".repeat(40), { "portfolio.yml": text, "bindings.yml": bindings }),
      );
    await apply("items:\n  alpha:\n    items:\n      beta: {}\n      gamma: {}\n");
    expect(portfolio.usageItem("alpha")).toBe("alpha/other");
    expect(portfolio.createdProjects()[0]).toMatchObject({
      createdItem: "beta",
      unresolved: false,
      usageItem: "beta",
      resolution: { via: "created" },
    });
    await apply(
      "items:\n  alpha:\n    items:\n      beta: { archived: true }\n      gamma: { archived: true }\n",
    );
    expect(portfolio.usageItem("alpha")).toBe("alpha/other");
    expect(portfolio.createdProjects()[0]?.unresolved).toBe(true);
    await apply(
      "items:\n  alpha:\n    items:\n      beta: { archived: true }\n      gamma: {}\n",
      "t3codeProjects:\n  chosen: { environment: local, project: p1, item: alpha, archived: true }\n",
    );
    expect(portfolio.createdProjects()[0]).toMatchObject({
      actorId: "a1",
      createdItem: "beta",
      unresolved: false,
      usageItem: "alpha/other",
      resolution: { via: "binding", archived: true },
    });
    await apply("items:\n  alpha: {}\n");
    expect(portfolio.usageItem("alpha")).toBe("alpha");
    expect(portfolio.createdProjects()[0]?.resolution.via).toBe("unbound");
  } finally {
    store.close();
  }
});
