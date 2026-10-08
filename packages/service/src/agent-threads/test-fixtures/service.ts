// ---
// relationships:
//   verifies: [agent-threads, durable-event-delivery, actor-host]
// ---
import { stringify } from "yaml";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openPortfolio, portfolioMigrationSteps } from "../../portfolio/index.ts";
import { ledgerMigrationSteps } from "../../ledger/index.ts";
import { openAgentThreads } from "../index.ts";
import type { AcceptedCommand } from "../index.ts";
import { openHistory } from "../../history/index.ts";
import { openStore } from "../../store/index.ts";
import type { PersistedSnapshot } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import { openActorHost, invocationOf, recordStateEntry } from "../../actor-host/index.ts";
import type { ActorHost } from "../../actor-host/index.ts";
import { createBlueprintLoader } from "../../blueprint-loader/index.ts";
import { serviceImplementations } from "../../implementations.ts";
import { startT3CodeSource } from "../../t3code-source/index.ts";
import type { EnvironmentsConfiguration, T3CodeSource } from "../../t3code-source/index.ts";
export interface FixtureConfiguration {
  path: string;
  token: string;
  environments: EnvironmentsConfiguration;
  crash?: "t3code-project-create" | "thread-create" | "turn-start";
  projectCreate?: boolean;
  projectInput?: Record<string, unknown>;
  onSave?: (snapshot: PersistedSnapshot) => void;
  probe?: (command: AcceptedCommand) => void;
}
export async function fixtureService(configuration: FixtureConfiguration) {
  const store = openStore({ path: configuration.path });
  const history = openHistory({ store, log: () => {} });
  store.connection.migrate("ledger", ledgerMigrationSteps);
  store.connection.migrate("portfolio", portfolioMigrationSteps);
  const portfolio = openPortfolio({
    connection: store.connection,
    createdProject: (project) => source?.createdProject(project.environment, project.id),
  });
  await portfolio.apply(
    memoryRevision("b".repeat(40), {
      "portfolio.yml": stringify({ items: { beta: {} } }),
      "bindings.yml": "{}",
    }),
  );
  const commit = "a".repeat(40);
  const actorId = "worker";
  let host: ActorHost;
  let source: T3CodeSource;
  const mapping = (expression: string) => ({ type: "expression.map", params: { expression } });
  const assignment = (expression: string) => ({
    type: "expression.assign",
    params: { expression },
  });
  const own = {
    type: "expression.guard",
    params: { expression: "event.threadId = context.thread and event.messageId = context.message" },
  };
  const document = {
    machine: {
      id: "parcel",
      context: { thread: "", message: "", started: 0, workspace: "project" },
      initial: "working",
      states: {
        working: {
          initial: configuration.projectCreate ? "creating" : "opening",
          on: {
            "t3.turn.started": {
              guard: own,
              actions: assignment('{ "started": context.started + 1 }'),
            },
            "t3.turn.settled": { guard: own, target: "done" },
          },
          states: {
            creating: {
              invoke: {
                id: "creating",
                src: "t3code-project-create",
                input: mapping(
                  JSON.stringify({
                    title: "Parcel {{ parcel }}",
                    workspaceRoot: "/work/{{ parcel }}",
                    values: { parcel: "sample" },
                    createWorkspaceRoot: true,
                    ...configuration.projectInput,
                  }),
                ),
                onDone: {
                  target: "opening",
                  actions: assignment('{ "workspace": event.output.projectId }'),
                },
                onError: {
                  target: "#parcel.failed",
                  actions: assignment('{ "error": event.error }'),
                },
              },
            },
            opening: {
              invoke: {
                id: "opening",
                src: "thread-create",
                input: mapping(
                  '{ "project": context.workspace, "title": "Parcel {{ parcel }}", "values": { "parcel": "sample" }, "model": { "instanceId": "provider", "model": "model" }, "runtimeMode": "approval-required" }',
                ),
                onDone: {
                  target: "preparing",
                  actions: ["follow-thread", assignment('{ "thread": event.output.threadId }')],
                },
              },
            },
            preparing: {
              invoke: {
                id: "preparing",
                src: "turn-prepare",
                onDone: {
                  target: "prompting",
                  actions: assignment('{ "message": event.output.messageId }'),
                },
              },
            },
            prompting: {
              invoke: {
                id: "prompting",
                src: "turn-start",
                input: mapping(
                  '{ "threadId": context.thread, "messageId": context.message, "prompt": "templates/parcel.njk", "values": { "parcel": "sample" } }',
                ),
                onDone: "waiting",
              },
            },
            waiting: {},
          },
        },
        done: { type: "final" },
        failed: { type: "final" },
      },
    },
    schemas: {
      input: true,
      output: true,
      context: true,
      events: { "t3.turn.started": true, "t3.turn.settled": true },
      actors: {
        "t3code-project-create": { input: true, output: true },
        "thread-create": { input: true, output: true },
        "turn-prepare": { input: true, output: true },
        "turn-start": { input: true, output: true },
      },
    },
  };
  const revision = memoryRevision(commit, {
    "blueprints/parcel.yml": stringify(document),
    "templates/parcel.njk": "Process {{ parcel }}",
  });
  const module = openAgentThreads({
    environments: configuration.environments,
    tokenFile: () => configuration.token,
    invocationOf,
    actorOf: (id) => host.actorOf(id),
    bindingArchived: () => false,
    sourcePlatform: (environment, signal) => source.platform(environment, signal),
    recordProject: (record) => source.recordCreatedProject(record),
    sourceWrite: (environment, thread, signal, send) =>
      source.write(environment, thread, signal, send),
    sourceReady: (environment, signal) => source.ready(environment, signal),
    revisionAt: async () => revision,
    sending: history.commandSending,
    probe(command) {
      configuration.probe?.(command);
      if (configuration.crash === command.implementation) process.kill(process.pid, "SIGKILL");
      if (command.implementation !== "t3code-project-create") history.commandAccepted(command);
    },
  });
  const loader = createBlueprintLoader({
    implementations: serviceImplementations({ agentThreads: module.implementations }),
    revisionAt: async () => revision,
    onExpressionError: () => {},
    onStateEntry: recordStateEntry,
  });
  const loaded = await loader.version({ commit, path: "blueprints/parcel.yml" });
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  const listeners = new Set<(snapshot: PersistedSnapshot) => void>();
  host = await openActorHost({
    store,
    blueprints: loader,
    log: () => {},
    saveHooks: [
      history.saveHook,
      (save) => {
        configuration.onSave?.(save.snapshot);
        for (const listener of listeners) listener(save.snapshot);
      },
    ],
  });
  const router = startRouter({ store, host });
  source = startT3CodeSource({
    store,
    router,
    environments: configuration.environments,
    tokenFile: () => configuration.token,
  });
  if (!store.loadSnapshot(actorId))
    host.start({
      actorId,
      blueprint: loaded.blueprint,
      input: {
        manifold: {
          environment: "station",
          project: "binding",
          threads: [],
          portfolioItem: "beta",
        },
      },
    });
  // Observe only durable snapshots, including saves made by the real host on restore.
  const actor = {
    getSnapshot: () =>
      store.loadSnapshot(actorId)!.snapshot as PersistedSnapshot & {
        context: {
          thread: string;
          message: string;
          started: number;
          workspace: string;
          error?: unknown;
        };
      },
    subscribe(listener: (snapshot: PersistedSnapshot) => void) {
      listeners.add(listener);
      return { unsubscribe: () => listeners.delete(listener) };
    },
  };
  return {
    actor,
    history,
    portfolio,
    source,
    router,
    store,
    async stop() {
      await module.stop();
      await source.stop();
      router.stop();
      store.close();
    },
  };
}
