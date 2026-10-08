// ---
// relationships:
//   verifies: usage-intake
// ---
import { createHttpHost } from "../../http-host/index.ts";
import { openStore } from "../../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../../ledger/index.ts";
import { lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import type { LedgerConnection } from "../../ledger/index.ts";
import { openUsage, usageMigrationSteps } from "../index.ts";
import type { UsageActorSave } from "../index.ts";
const config = JSON.parse(process.argv[2]!) as { path: string; crash: boolean };
const store = openStore({ path: config.path });
store.connection.migrate("ledger", ledgerMigrationSteps);
store.connection.migrate("usage", usageMigrationSteps);
const lint = lintPortfolioDeclaration({
  portfolio: "items: { alpha: {}, beta: {} }",
  bindings: undefined,
});
if (!lint.ok) throw Error("Invalid fixture portfolio");
const declaration = lint.declaration;
const connection: LedgerConnection = {
  transaction: (work) => store.connection.transaction(work),
  database: {
    prepare: (sql) => {
      const statement = store.connection.database.prepare(sql);
      return {
        get: (...args) => statement.get(...args),
        all: (...args) => statement.all(...args),
        run: (...args) => {
          const result = statement.run(...args);
          if (config.crash && sql.startsWith("INSERT INTO usage_reattributions")) {
            process.send?.("inside");
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
          }
          return result;
        },
      };
    },
  },
};
const ledger = createLedger({ connection, portfolio: parseLedgerPortfolio(declaration.ledger) });
ledger.credit({
  key: "credit",
  account: "acct",
  window: "w1",
  opensAt: 0,
  closesAt: 10000,
  amount: 1000,
});
const usage = openUsage({
  connection,
  ledger,
  portfolio: {
    current: () => ({ commit: null, declaration }),
    t3codeProject: () => ({ item: "beta", via: "binding", binding: "sample", archived: false }),
  },
  threadProject: () => "project-1",
  environments: new Set(["env-one"]),
});
await usage.apply({
  commit: "commit-1",
  read: async (path) =>
    path === "accounts.yml"
      ? "accounts:\n  acct:\n    unit: usd\n    kind: api\n    capacity: { amount: 1, reset: '2026-01-01T00:00:00Z', every: { hours: 1 } }\n    usage: [{ environment: env-one, provider: codex }]"
      : "unit: usd\nmodels:\n  model-a: { standard: { input: 2, output: 8 } }",
});
const http = createHttpHost({
  configuration: { host: "127.0.0.1", port: 0 },
  onError: (error) => {
    throw error;
  },
});
http.mount("/api/usage", usage.listener);
http.mount("/fixture/save", (request, response) => {
  void (async () => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    usage.saveHook(JSON.parse(Buffer.concat(chunks).toString()) as UsageActorSave);
    response.end("saved");
  })().catch((error) => {
    response.writeHead(500);
    response.end(String(error));
  });
});
process.send?.({ port: (await http.listen()).port });
