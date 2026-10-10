// ---
// relationships:
//   verifies: [portfolio, portfolio-declaration, host-cli-portfolio-lint, host-cli-usage]
// ---
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { beforeAll, afterAll, expect, test } from "vite-plus/test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { memoryRevision, lintAllocatedAccounts } from "@wyrd-company/manifold-shared";
import { openPortfolio, portfolioMigrationSteps } from "./index.ts";
import { openStore } from "../store/index.ts";
import { ledgerMigrationSteps } from "../ledger/index.ts";
let directory: string;
let binary: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "allocated-accounts-cli-"));
  binary = childArtifacts().host;
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

const accountText = `accounts:
  acct:
    unit: usd
    kind: api
    capacity: { amount: 10, reset: '2026-01-01T00:00:00Z', every: { days: 1 } }
`;
test.each([
  "declared",
  "undeclared",
  "missing",
  "invalid-binding",
  "invalid-accounts",
  "invalid-portfolio",
  "invalid-prices",
])("service portfolio apply and both compiled lints agree on $0 account warnings", async (name) => {
  const checkout = join(directory, "portfolio-" + name);
  await mkdir(checkout);
  const portfolioText =
    name === "invalid-portfolio" ? "items: []" : "items: { alpha: { allocations: { acct: {} } } }";
  const accounts =
    name === "missing"
      ? undefined
      : name === "invalid-accounts"
        ? "["
        : ["undeclared", "invalid-binding", "invalid-prices"].includes(name)
          ? "{}"
          : accountText;
  const files = {
    "portfolio.yml": portfolioText,
    "bindings.yml":
      name === "invalid-binding"
        ? "t3codeProjects: { first: { environment: env-one, project: workspace-one, item: absent } }"
        : "{}",
    "prices.yml": name === "invalid-prices" ? "[" : "{}",
    ...(accounts === undefined ? {} : { "accounts.yml": accounts }),
  };
  for (const [file, text] of Object.entries(files)) await writeFile(join(checkout, file), text);
  const store = openStore({ path: join(checkout, "store.sqlite") });
  try {
    store.connection.migrate("ledger", ledgerMigrationSteps);
    store.connection.migrate("portfolio", portfolioMigrationSteps);
    const portfolio = openPortfolio({ connection: store.connection });
    const revision = memoryRevision("a".repeat(40), files);
    const expected = lintAllocatedAccounts({ portfolio: portfolioText, accounts });
    const warned = ["undeclared", "missing", "invalid-binding", "invalid-prices"].includes(name);
    expect(expected).toHaveLength(warned ? 1 : 0);
    for (const status of ["applied", "unchanged"]) {
      const result = await portfolio.apply(revision);
      expect(result.status).toBe(
        ["invalid-binding", "invalid-portfolio"].includes(name) ? "rejected" : status,
      );
      expect(result).toHaveProperty("warnings", expected);
    }
    for (const command of ["portfolio", "usage"]) {
      for (const explicit of [false, true]) {
        const result = spawnSync(binary, [command, "lint", ...(explicit ? [checkout] : [])], {
          cwd: explicit ? directory : checkout,
          encoding: "utf8",
        });
        expect(result.error).toBeUndefined();
        expect(result.stderr).toBe("");
        const rejected =
          command === "portfolio"
            ? ["invalid-binding", "invalid-portfolio"].includes(name)
            : ["invalid-accounts", "invalid-prices"].includes(name);
        expect(result.status).toBe(rejected ? 1 : 0);
        const lines = result.stdout
          .split("\n")
          .filter((line) => line.includes("account-undeclared"));
        expect(lines).toEqual(
          expected.map(
            (warning) =>
              `${warning.file}.yml:${warning.location} ${warning.kind} ${warning.message} (warning)`,
          ),
        );
        if (!rejected && !warned) expect(result.stdout).toBe("");
        if (warned && name !== "invalid-binding")
          expect(
            portfolio.ledger.balance({ item: "alpha", account: "acct", waiting: [] }).allocation,
          ).toBe(0);
      }
    }
    expect(
      store.connection.database
        .prepare("SELECT count(*) AS count FROM portfolio_declarations")
        .get()?.["count"],
    ).toBe(["invalid-binding", "invalid-portfolio"].includes(name) ? 0 : 1);
    const reopened = openPortfolio({ connection: store.connection });
    expect(await reopened.apply(revision)).toMatchObject({
      status: ["invalid-binding", "invalid-portfolio"].includes(name) ? "rejected" : "unchanged",
      warnings: expected,
    });
  } finally {
    store.close();
  }
});
test.each(["portfolio", "usage"])(
  "compiled %s lint reads its cross-file input before printing",
  async (command) => {
    const checkout = join(directory, "cross-file-unreadable-" + command);
    await mkdir(checkout);
    const unreadable = command === "portfolio" ? "accounts.yml" : "portfolio.yml";
    await mkdir(join(checkout, unreadable));
    await writeFile(
      join(checkout, command === "portfolio" ? "portfolio.yml" : "accounts.yml"),
      "[",
    );
    const result = spawnSync(binary, [command, "lint", checkout], { encoding: "utf8" });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(new RegExp("^" + unreadable + ": "));
  },
);
