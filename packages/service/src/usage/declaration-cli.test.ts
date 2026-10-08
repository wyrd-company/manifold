// ---
// relationships:
//   verifies: [usage-intake, host-cli-usage]
// ---
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { beforeAll, afterAll, expect, test } from "vite-plus/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import { openUsage, usageMigrationSteps } from "./index.ts";
import { openHistory } from "../history/index.ts";
import { openStore } from "../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../ledger/index.ts";
import {
  usageLintCases,
  writeUsageLintCase,
} from "../../../host-cli/src/usage-lint/test-fixtures/cases.ts";
let directory: string;
let binary: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "usage-lint-apply-"));
  binary = childArtifacts().host;
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
test.each(usageLintCases)(
  "service apply matches the compiled command for the same $name files",
  async (fixture) => {
    const checkout = join(directory, fixture.name);
    await writeUsageLintCase(checkout, fixture);
    const store = openStore({ path: join(checkout, "store.sqlite") });
    try {
      store.connection.migrate("ledger", ledgerMigrationSteps);
      store.connection.migrate("usage", usageMigrationSteps);
      const usage = openUsage({
        visits: openHistory({ store: store, log: () => {} }),
        connection: store.connection,
        ledger: createLedger({
          connection: store.connection,
          portfolio: parseLedgerPortfolio({ items: [], allocations: [] }),
        }),
        portfolio: {
          current: () => {
            const lint = lintPortfolioDeclaration({
              portfolio: "items: { alpha: {} }",
              bindings: undefined,
            });
            if (!lint.ok) throw new Error("Invalid fixture portfolio");
            return { commit: "portfolio-1", declaration: lint.declaration };
          },
          t3codeProject: () => ({ item: "other", via: "unbound" }),
        },
        threadProject: () => undefined,
        environments: new Set(),
      });
      const applied = await usage.apply({
        commit: "revision-one",
        read: async (file) => {
          try {
            return await readFile(join(checkout, file), "utf8");
          } catch (error) {
            if (
              error !== null &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "ENOENT"
            )
              return undefined;
            throw error;
          }
        },
      });
      const result = spawnSync(binary, ["usage", "lint"], { cwd: checkout, encoding: "utf8" });
      expect(result.error).toBeUndefined();
      expect(result.stderr).toBe("");
      if (applied.status === "rejected") {
        expect(result.status).toBe(1);
        const findings = ["accounts", "prices"].flatMap((file) =>
          applied.findings.filter((finding) => finding.file === file),
        );
        expect(result.stdout).toBe(
          findings
            .map(
              (finding) =>
                `${finding.file}.yml:${finding.location} ${finding.kind} ${finding.message.replace(/\s*\r?\n\s*/g, " ")}\n`,
            )
            .join(""),
        );
        expect(usage.accounts()).toEqual({});
      } else {
        expect(result.status).toBe(0);
        expect(result.stdout).toBe("");
      }
    } finally {
      store.close();
    }
  },
);
