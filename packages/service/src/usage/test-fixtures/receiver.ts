// ---
// relationships:
//   verifies: usage-intake
// ---
import { createHttpHost } from "../../http-host/index.ts";
import { openStore } from "../../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../../ledger/index.ts";
import { openUsage, usageMigrationSteps } from "../index.ts";
const config = JSON.parse(process.argv[2]!) as { path: string; crash: string };
const store = openStore({ path: config.path });
store.connection.migrate("ledger", ledgerMigrationSteps);
store.connection.migrate("usage", usageMigrationSteps);
const portfolio = parseLedgerPortfolio({
  items: [{ id: "alpha", parent: null }],
  allocations: [{ item: "alpha", account: "acct", guarantee: 100 }],
});
const ledger = createLedger({ connection: store.connection, portfolio });
ledger.credit({
  key: "credit-1",
  account: "acct",
  window: "window-1",
  opensAt: Date.UTC(2026, 0, 1),
  closesAt: Date.UTC(2026, 0, 2),
  amount: 1000000,
});
let requestNumber = 0;
const pause = (message: string) => {
  process.send?.(message);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
};
const usage = openUsage({
  connection: store.connection,
  ledger: {
    settle: ledger.settle,
    postActual: (request) => {
      const result = ledger.postActual(request);
      if (config.crash === "inside" && requestNumber === 2) pause("inside");
      return result;
    },
  },
  portfolio: { t3codeProject: () => ({ item: "other", via: "unbound" }) },
  threadProject: () => undefined,
  environments: new Set(["env-one"]),
});
await usage.apply({
  commit: "commit-1",
  read: async (path) =>
    path === "accounts.yml"
      ? "accounts:\n  acct:\n    unit: usd\n    usage: [{ environment: env-one, provider: codex, instance: instance-one }]"
      : "unit: usd\nmodels:\n  model-a: { standard: { input: 2, output: 8 } }",
});
usage.saveHook({
  actorId: "actor-one",
  snapshot: {
    status: "active",
    value: "working",
    context: {
      manifold: { environment: "env-one", portfolioItem: "alpha", threads: ["thread-one"] },
    },
  },
});
const http = createHttpHost({
  configuration: { host: "127.0.0.1", port: 0, operatorCredential: undefined },
  credentials: {
    names: [],
    resolve: () => {
      throw Error("No credentials");
    },
  },
  onError: (error) => {
    throw error;
  },
});
http.mount("/api/usage", (request, response) => {
  requestNumber++;
  const end = response.end.bind(response);
  response.end = ((...args: Parameters<typeof response.end>) => {
    if (config.crash === "committed" && requestNumber === 2) pause("committed");
    return end(...args);
  }) as typeof response.end;
  usage.listener(request, response);
});
const { port } = await http.listen();
process.send?.({ port });
