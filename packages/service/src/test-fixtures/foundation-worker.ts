// ---
// relationships:
//   verifies: [process-repository, blueprint-loader, portfolio, durable-event-delivery, github-event-source, t3code-environment-source]
// ---
import { createActor } from "xstate";
import type { Snapshot } from "xstate";
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import { openProcessRepository } from "../process-repository/index.ts";
import { createBlueprintLoader } from "../blueprint-loader/index.ts";
import type { LoadedBlueprint } from "../blueprint-loader/index.ts";
import { openStore } from "../store/index.ts";
import type { DeliveryTarget, StoredSnapshot, PersistedSnapshot } from "../store/index.ts";
import { ledgerMigrationSteps } from "../ledger/index.ts";
import { openPortfolio, portfolioMigrationSteps } from "../portfolio/index.ts";
import { startRouter } from "../router/index.ts";
import { startGitHubSource } from "../github-source/index.ts";
import type { GitHubConfiguration } from "../github-source/index.ts";
import { startT3CodeSource, threadTopic } from "../t3code-source/index.ts";
import type { EnvironmentsConfiguration } from "../t3code-source/index.ts";
import { SecretValue } from "../service-configuration/index.ts";
import type {
  Credentials,
  ProcessRepositoryConfiguration,
} from "../service-configuration/index.ts";
import { signedDelivery } from "../github-source/test-fixtures/api.ts";

export interface FoundationWorkerConfiguration {
  path: string;
  repository: ProcessRepositoryConfiguration;
  github: GitHubConfiguration;
  environments: EnvironmentsConfiguration;
  token: string;
  crash: boolean;
}
const configuration = JSON.parse(process.argv[2]!) as FoundationWorkerConfiguration;
const notify = (type: string, detail?: unknown) => process.send?.({ type, detail });
const credentials: Credentials = {
  names: ["api-reader"],
  resolve: (name) => ({
    kind: "github-app",
    name,
    installationToken: async () => new SecretValue(name, "synthetic-token"),
  }),
};
const repository = await openProcessRepository({
  configuration: configuration.repository,
  credentials,
});
await repository.pull();
const revision = repository.current()!;
const store = openStore({
  path: configuration.path,
  now: () => 10,
  probe(step, row) {
    const type = (row.payload as { type: string }).type;
    if (configuration.crash && step === "saved" && type === "github.issue.closed") {
      notify("inside-delivery", { eventId: row.eventId, type });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    }
    if (step === "saved") setImmediate(() => notify("delivered", { eventId: row.eventId, type }));
  },
});
store.connection.migrate("ledger", ledgerMigrationSteps);
store.connection.migrate("portfolio", portfolioMigrationSteps);
const portfolio = openPortfolio({ connection: store.connection, now: () => 10 });
const loader = createBlueprintLoader({
  implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
  revisionAt: repository.revisionAt,
  onExpressionError: (error) => {
    throw error;
  },
});
const loaded = await loader.loadRevision(revision);
if (loaded.failures.size) throw new Error(JSON.stringify([...loaded.failures]));
const blueprints = new Map<string, LoadedBlueprint>();
for (const blueprint of loaded.blueprints.values()) blueprints.set(blueprint.key, blueprint);
const actorId = "oven-one";
const previous = store.loadSnapshot(actorId);
if (!previous) {
  const applied = await portfolio.apply(revision);
  if (applied.status !== "applied") throw new Error(JSON.stringify(applied));
  portfolio.ledger.credit({
    key: "credit-one",
    account: "meter",
    window: "morning",
    opensAt: 0,
    closesAt: 1000,
    amount: 100,
  });
  portfolio.ledger.reserve({
    key: "reserve-one",
    actor: actorId,
    item: "baking",
    account: "meter",
    amount: 20,
  });
} else {
  const version = parseBlueprintVersionKey(previous.machine);
  if (!version) throw new Error("Invalid stored blueprint identity");
  const result = await loader.version(version);
  if (result.status !== "loaded") throw new Error(JSON.stringify(result));
  blueprints.set(result.blueprint.key, result.blueprint);
}
const actors: ReturnType<typeof createActor>[] = [];
function target(blueprint: LoadedBlueprint, stored?: StoredSnapshot): DeliveryTarget {
  const snapshot = stored?.snapshot as Snapshot<unknown> | undefined;
  if (snapshot && !blueprint.checkRestore(snapshot).ok) throw new Error("Restore mismatch");
  const actor = createActor(blueprint.machine, snapshot ? { snapshot } : {}).start();
  actors.push(actor);
  return {
    actorId,
    send(row) {
      const event = row.payload as { type: string };
      portfolio.ledger.postActual({
        key: `actual:${row.eventId}`,
        actor: actorId,
        item: "baking",
        account: "meter",
        amount: event.type === "t3.turn.started" ? 5 : 7,
        usedAt: 10,
      });
      actor.send(event);
    },
    persist: () => ({
      machine: blueprint.key,
      snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
    }),
  };
}
const router = startRouter({
  store,
  host: {
    subscription(record) {
      const blueprint = blueprints.get(record.machine)!;
      return {
        topics: ["github.issue.I_A", threadTopic("station", "conversation")],
        events: Object.keys(blueprint.document.schemas.events),
      };
    },
    restore(stored) {
      return { status: "restored", target: target(blueprints.get(stored.machine)!, stored) };
    },
  },
  onHeld: (held) => {
    throw new Error(JSON.stringify(held));
  },
});
if (!previous) router.attach(target(loaded.blueprints.get("blueprints/oven.yml")!));
const github = startGitHubSource({
  configuration: configuration.github,
  credentials,
  store,
  router,
  boundProjects: () =>
    portfolio.current().declaration.githubProjects.map(({ owner, number }) => ({ owner, number })),
  processRepository: {
    ...repository,
    url: configuration.repository.url,
    branch: configuration.repository.branch,
  },
  onError: (error) => {
    throw error;
  },
  probe() {
    setImmediate(() => {
      if (github.trackedIssue("I_A")) notify("github-baseline");
    });
  },
});
const t3 = startT3CodeSource({
  store,
  router,
  environments: configuration.environments,
  tokenFile: () => configuration.token,
});
notify("started", {
  current: revision.commit,
  machine: store.loadSnapshot(actorId)!.machine,
  portfolio: portfolio.current().commit,
});
process.on("message", async (message) => {
  if (message === "webhook" || message === "redelivery") {
    notify(
      "received",
      github.receive(signedDelivery("issues", { issue: { node_id: "I_A" } }, "closed-one")),
    );
  } else if (message === "stop") {
    await Promise.all([github.stop(), t3.stop()]);
    notify("report", {
      snapshot: store.loadSnapshot(actorId),
      pending: store.pendingInbox(actorId),
      usage: portfolio.ledger.actorUsage(actorId),
      balance: portfolio.ledger.balance({ item: "baking", account: "meter", waiting: [] }),
      portfolio: portfolio.current().commit,
    });
    router.stop();
    for (const actor of actors) actor.stop();
    store.close();
    process.disconnect?.();
  }
});
