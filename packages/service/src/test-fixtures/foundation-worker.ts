// ---
// relationships:
//   verifies: [service-assembly, process-repository, blueprint-loader, portfolio, durable-event-delivery, github-event-source, t3code-environment-source]
// ---
import { createActor } from "xstate";
import type { Snapshot } from "xstate";
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { LoadedBlueprint } from "../blueprint-loader/index.ts";
import type { DeliveryTarget, StoredSnapshot, PersistedSnapshot, Store } from "../store/index.ts";
import type { Portfolio } from "../portfolio/index.ts";
import type { GitHubConfiguration } from "../github-source/index.ts";
import { threadTopic } from "../t3code-source/index.ts";
import type { EnvironmentsConfiguration } from "../t3code-source/index.ts";
import type { ProcessRepositoryConfiguration } from "../service-configuration/index.ts";
import { signedDelivery } from "../github-source/test-fixtures/api.ts";
import { startService } from "../service/index.ts";
import { generateKeyPairSync } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
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
const directory = dirname(configuration.path);
const privateKeyFile = join(directory, "key.pem");
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
await writeFile(privateKeyFile, privateKey.export({ type: "pkcs1", format: "pem" }));
const configurationFile = join(directory, "service.yml");
await writeFile(
  configurationFile,
  stringify({
    store: { file: configuration.path },
    processRepository: configuration.repository,
    github: configuration.github,
    environments: configuration.environments,
    http: { port: 0 },
    credentials: {
      "api-reader": {
        kind: "github-app",
        appId: 1,
        installationId: 2,
        privateKeyFile,
        apiUrl: configuration.github.apiUrl,
      },
      reader: { kind: "t3code-token", tokenFile: configuration.token },
    },
  }),
);
let store!: Store;
let portfolio!: Portfolio;
const blueprints = new Map<string, LoadedBlueprint>();
const actorId = "oven-one";
let previous: StoredSnapshot | undefined;
let loaded!: Awaited<
  ReturnType<import("../blueprint-loader/index.ts").BlueprintLoader["loadRevision"]>
>;
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
const service = await startService({
  configurationFile,
  log: () => {},
  probes: {
    delivery(step, row) {
      const type = (row.payload as { type: string }).type;
      if (configuration.crash && step === "saved" && type === "github.issue.closed") {
        notify("inside-delivery", { eventId: row.eventId, type });
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      }
      if (step === "saved") setImmediate(() => notify("delivered", { eventId: row.eventId, type }));
    },
  },
  actorHost: async (parts) => {
    store = parts.store;
    portfolio = parts.portfolio;
    const loader = parts.blueprints;
    loaded = parts.revisions.latest()!;
    if (loaded.failures.size) throw new Error(JSON.stringify([...loaded.failures]));
    for (const blueprint of loaded.blueprints.values()) blueprints.set(blueprint.key, blueprint);
    previous = store.loadSnapshot(actorId);
    if (!previous) {
      portfolio.ledger.credit({
        key: "credit-one",
        account: "meter",
        window: "morning",
        opensAt: 0,
        closesAt: Number.MAX_SAFE_INTEGER,
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
    return {
      start: () => {},
      actorOf: () => undefined,
      followers: () => [],
      followedThreads: () => [],
      issueThreads: () => [],
      eventSchema: () => ({ status: "unavailable" }),
      release: async () => {},
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
    };
  },
});
const { router, github } = service;
if (!previous) router.attach(target(loaded.blueprints.get("blueprints/oven.yml")!));
const baseline = setInterval(() => {
  if (github.trackedIssue("I_A")) {
    clearInterval(baseline);
    notify("github-baseline");
  }
}, 10);
notify("started", {
  current: service.processRepository.current()!.commit,
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
    await Promise.all([github.stop(), service.t3code.stop()]);
    notify("report", {
      snapshot: store.loadSnapshot(actorId),
      pending: store.pendingInbox(actorId),
      usage: portfolio.ledger.actorUsage(actorId),
      balance: portfolio.ledger.balance({ item: "baking", account: "meter", waiting: [] }),
      portfolio: portfolio.current().commit,
    });
    clearInterval(baseline);
    await service.stop();
    for (const actor of actors) actor.stop();

    process.disconnect?.();
  }
});
