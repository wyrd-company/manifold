// ---
// relationships:
//   verifies: [operator-console, tasks-api, portfolio-api, escalation-contract]
// ---
import { lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
import { boardWorld } from "../../tasks/test-fixtures/world.ts";
import { createLedger } from "../../ledger/index.ts";
import { openTasks } from "../../tasks/index.ts";
import { startRouter } from "../../router/index.ts";
import { mountPortfolioApi } from "../../portfolio-api/index.ts";
import { mountEscalations } from "../../escalations/index.ts";
import { mountConsole } from "../index.ts";
import { consoleHost } from "./host.ts";
import { openHistory } from "../../history/index.ts";
import { openEnvironments } from "../../environments/index.ts";
export async function overviewWorld() {
  const f = boardWorld(true);
  const server = await consoleHost();
  const now = Date.now();
  for (const id of ["parcel", "waiting", "child"])
    f.store.saveSnapshot({
      actorId: id === "child" ? id : `task:${id}`,
      machine: `${"b".repeat(40)}:blueprints/delivery.yml`,
      snapshot: {
        status: "active",
        value: "waiting",
        context: {
          manifold: {
            environment: "sample-host",
            portfolioItem: "alpha",
            threads: id === "parcel" ? ["thread-1"] : [],
          },
        },
      },
    });
  const router = startRouter({
    store: f.store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: (stored) =>
        stored.actorId === "task:waiting"
          ? { status: "held", reason: "Sample failure" }
          : {
              status: "restored",
              target: {
                actorId: stored.actorId,
                send: () => {},
                persist: () => ({ machine: stored.machine, snapshot: stored.snapshot }),
              },
            },
    },
  });
  const held = f.module.raise({
    kind: "held-actor",
    subject: { actorId: "task:waiting" },
    title: "Collection stopped",
    question: "Try again?",
    choices: [{ id: "dismiss", label: "Dismiss" }],
  });
  f.module.answer(held.id, { choice: "dismiss" }, "api");
  const references = new Map(
    f.projects.map((p) => [
      `project-${p.number}`,
      { nodeId: `project-${p.number}`, owner: p.owner, number: p.number },
    ]),
  );
  const tasks = openTasks({
    store: f.store,
    held: (id) => !!router.held(id),
    boundProjects: () => f.projects,
    github: {
      trackedIssues: () => f.mirror.trackedIssues(references),
    },
    actorUsage: f.ledger.actorUsage,
    accountUnit: () => "usd",
    listEscalations: f.module.list,
    thread: (_environment, id) =>
      id === "thread-1"
        ? { url: "https://example.test/environment/thread-1", archived: false }
        : undefined,
    tokenHolder: () => undefined,
  });
  const declaration = lintPortfolioDeclaration({
    portfolio: stringify({
      items: {
        alpha: { allocations: { "acct-a": { guarantee: 50 } } },
        beta: {
          allocations: { "acct-a": { guarantee: 50 } },
          items: { "beta-one": { allocations: { "acct-a": { guarantee: 20 } } } },
        },
      },
    }),
    bindings: undefined,
  });
  if (!declaration.ok) throw Error(JSON.stringify(declaration));
  const ledger = createLedger({
    connection: f.store.connection,
    portfolio: declaration.ledgerPortfolio,
    now: () => now,
  });
  for (const account of ["acct-a", "acct-b"])
    ledger.credit({
      key: `overview-credit:${account}`,
      account,
      window: "current",
      opensAt: now - 1000,
      closesAt: now + 86400000,
      amount: 10000000,
    });
  for (const [item, amount] of [
    ["alpha", 4250000],
    ["beta", 1150000],
    ["beta-one", 850000],
  ] as const)
    ledger.postActual({
      key: `overview-actual:${item}`,
      actor: `task:${item}`,
      item,
      account: "acct-a",
      amount,
      usedAt: now,
    });
  // Account use reaches 85%; the extra usage has no portfolio allocation.
  ledger.postActual({
    key: "overview-extra",
    actor: "session:sample",
    item: "other",
    account: "acct-a",
    amount: 2250000,
    usedAt: now,
  });
  mountConsole(server.host, {
    store: f.store,
    history: openHistory({ store: f.store, log: () => {} }),
  });
  server.host.mount("/api/tasks", tasks.requestListener);
  mountEscalations(server.host, f.module);
  mountPortfolioApi(server.host, {
    lastUsedAt: () => ({}),
    pricing: () => ({ overrides: 0, unpriced: [] }),
    portfolio: { current: () => ({ commit: null, declaration: declaration.declaration }), ledger },
    accounts: () =>
      Object.fromEntries(
        ["acct-a", "acct-b"].map((name) => [
          name,
          {
            unit: "usd" as const,
            kind: "api" as const,
            capacity: { amount: 10, reset: new Date(now - 1000).toISOString(), every: { days: 7 } },
          },
        ]),
      ),
    processRepository: { revisionAt: async () => undefined },
    store: f.store,
    now: () => now,
    log: (e) => {
      throw Error(e.error);
    },
  });
  let environmentsFailed = false;
  const environments = openEnvironments({
    store: f.store,
    router,
    configurationFile: "service.yml",
    environments: Object.fromEntries(
      ["north", "south"].map((name) => [
        name,
        {
          url: `https://example.test/${name}`,
          credential: "sample",
          reconnect: { initialMs: 1000, factor: 2, maxMs: 30000, jitter: 0.2 },
          heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
          openTimeoutMs: 10000,
        },
      ]),
    ),
    status: () =>
      ["north", "south"].map((environment) => ({
        environment,
        state: "following",
        followedThreads: 1,
        activeThreads: 1,
        openSubscriptions: 1,
      })),
    restart: () => {},
    scheduled: (name) => (name === "south" ? 2 : 0),
  });
  server.host.mount("/api/environments", (request, response) => {
    if (environmentsFailed) {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          error: {
            kind: "action-failed",
            message: "Cannot read environments. Check the connection and try again.",
          },
        }),
      );
      return;
    }
    environments.requestListener(request, response);
  });
  const paused = await fetch(`${server.url}/api/environments/south/pause`, { method: "POST" });
  if (paused.status !== 200) throw Error("Fixture pause failed");
  return {
    url: server.url,
    ask: f.ask,
    askActor: () =>
      f.module.raise({
        kind: "held-actor",
        subject: { actorId: "child" },
        title: "Parcel check",
        question: "Try again?",
        choices: [{ id: "dismiss", label: "Dismiss" }],
      }),
    failEnvironments: (failed: boolean) => {
      environmentsFailed = failed;
    },
    async close() {
      router.stop();
      await server.close();
      await f.close();
    },
  };
}
