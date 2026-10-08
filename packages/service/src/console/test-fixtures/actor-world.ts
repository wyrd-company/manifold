// ---
// relationships:
//   verifies: [operator-console, actor-usage-api]
// ---
import { lintPortfolioDeclaration, memoryRevision } from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
import { boardWorld } from "../../tasks/test-fixtures/world.ts";
import { openTasks } from "../../tasks/index.ts";
import { openUsage, usageMigrationSteps } from "../../usage/index.ts";
import { createBlueprintLoader } from "../../blueprint-loader/index.ts";
import { openActorHost, recordStateEntry } from "../../actor-host/index.ts";
import { startRouter } from "../../router/index.ts";
import { threadTopic } from "../../t3code-source/index.ts";
import { actorsListener } from "../actors-api.ts";
import { openHistory } from "../../history/index.ts";
import type { HttpListener } from "../../http-host/index.ts";
const at = (n: number) => new Date(n * 1000).toISOString();
export async function actorWorld() {
  const f = boardWorld(true, false);
  let now = 0;
  const history = openHistory({ store: f.store, log: () => {}, now: () => now });
  f.store.connection.migrate("usage", usageMigrationSteps);
  const portfolio = lintPortfolioDeclaration({
    portfolio: "items: { deliveries: {} }",
    bindings: undefined,
  });
  if (!portfolio.ok) throw new Error("Invalid fixture portfolio");
  const usage = openUsage({
    connection: f.store.connection,
    ledger: f.ledger,
    portfolio: {
      current: () => ({ commit: revision.commit, declaration: portfolio.declaration }),
      t3codeProject: () => ({ item: "other", via: "unbound" }),
    },
    threadProject: () => undefined,
    environments: new Set(["sample-host"]),
    now: () => now,
  });
  await usage.apply({
    commit: "c".repeat(40),
    read: async (path) =>
      path === "accounts.yml"
        ? "accounts:\n  sample:\n    unit: usd\n    kind: api\n    capacity: { amount: 1, reset: '2026-01-01T00:00:00Z', every: {hours: 1} }\n    usage: [{ environment: sample-host, provider: codex }]"
        : "unit: usd\nmodels:\n  sample-model: {standard: {input: 1, output: 1}}",
  });
  const revision = memoryRevision("b".repeat(40), {
    "blueprints/delivery.yml": stringify({
      machine: {
        id: "parcel",
        initial: "waiting",
        states: {
          waiting: { on: { "github.project-item.field-changed": "packing" } },
          packing: {
            on: {
              "t3.turn.started": {},
              "github.project-item.field-changed": {},
              "agent.handoff": "complete",
            },
          },
          complete: { type: "final" },
        },
      },
      schemas: {
        input: { type: "object" },
        context: { type: "object" },
        output: true,
        events: {
          "github.project-item.field-changed": true,
          "t3.turn.started": true,
          "agent.handoff": true,
        },
        actors: {},
      },
    }),
  });
  const loader = createBlueprintLoader({
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    revisionAt: async () => revision,
    onExpressionError: () => {},
    onStateEntry: recordStateEntry,
  });
  const loaded = await loader.version({ commit: revision.commit, path: "blueprints/delivery.yml" });
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  const actors = await openActorHost({
    store: f.store,
    blueprints: loader,
    saveHooks: [history.saveHook, usage.saveHook],
    log: () => {},
    now: () => now,
  });
  const router = startRouter({
    store: f.store,
    host: actors,
    clock: { now: () => now, setTimer: () => () => {} },
  });
  const send = async (
    id: string,
    type: string,
    n: number,
    payload: Record<string, unknown> = {},
  ) => {
    now = n * 1000;
    const source = type.startsWith("agent.") ? "agent" : type.startsWith("t3.") ? "t3" : "github";
    const topic =
      source === "github"
        ? `github.issue.${id}`
        : threadTopic("sample-host", String(payload["threadId"])).replace(/^t3\./, `${source}.`);
    router.publish({
      source,
      eventId: `${id}-${type}-${n}`,
      topics: [topic],
      event: { type, ...payload },
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
  };
  for (const [id, thread] of [
    ["parcel", "thread-1"],
    ["waiting", "thread-2"],
  ] as const) {
    now = 0;
    actors.start({
      actorId: `task:${id}`,
      blueprint: loaded.blueprint,
      input: {
        manifold: {
          issue: id,
          environment: "sample-host",
          portfolioItem: "deliveries",
          threads: [thread],
        },
      },
    });
    const moved = (name: string) => ({
      field: { nodeId: "status-field", name: "Status" },
      to: { kind: "single-select", optionId: name.toLowerCase(), name },
      movedBy: { actorId: `task:${id}`, confirmed: true },
    });
    now = 10;
    history.commandSending({
      commandId: `create-${id}`,
      implementation: "thread-create",
      invocation: { actorId: `task:${id}`, invokeId: "create", entryId: "one" },
      environment: "sample-host",
      threadId: thread,
    });
    now = 50;
    history.commandSending({
      commandId: `start-${id}`,
      implementation: "turn-start",
      invocation: { actorId: `task:${id}`, invokeId: "run", entryId: "one" },
      environment: "sample-host",
      threadId: thread,
      messageId: `message-${id}`,
    });
    await send(id, "github.project-item.field-changed", 1, moved("Packing"));
    await send(id, "t3.turn.started", 2, {
      environment: "sample-host",
      threadId: thread,
      messageId: `message-${id}`,
      turnId: "turn-one",
    });
    usage.push({
      environment: "sample-host",
      threads: [{ provider: "codex", providerSessionId: id, threadId: thread }],
      records: [
        {
          type: "call",
          key: `call-${id}`,
          provider: "codex",
          providerSessionId: id,
          unit: { id, kind: "session" },
          timestamp: at(0.1),
          model: "sample-model",
          tokens: {
            input: 10,
            output: 5,
            cacheRead: 0,
            cacheWrite: 0,
            cacheWriteOneHour: 0,
            reasoning: 0,
            webSearchRequests: 0,
          },
          speed: "standard",
          granularity: "call",
          estimated: false,
        },
      ],
    });
    if (id === "parcel") {
      await send(id, "github.project-item.field-changed", 6, moved("Delivered"));
      await send(id, "agent.handoff", 7, {
        environment: "sample-host",
        threadId: thread,
        turnId: "turn-one",
      });
    }
  }
  const projects = new Map(
    f.projects.map((p) => [
      `project-${p.number}`,
      { nodeId: `project-${p.number}`, owner: p.owner, number: p.number },
    ]),
  );
  const tasks = openTasks({
    store: f.store,
    held: () => false,
    boundProjects: () => f.projects,
    github: {
      trackedIssueIds: () => f.mirror.trackedIssueIds(projects),
      trackedIssue: (id) => f.mirror.trackedIssue(id, projects),
    },
    actorUsage: usage.actorUsage,
    accountUnit: () => "usd",
    listEscalations: f.module.list,
    thread: (_env, id) => ({
      title: "Parcel delivery",
      url: `https://example.test/environment/${id}`,
      turn: id === "thread-1" ? "completed" : "running",
      archived: false,
    }),
    tokenHolder: () => undefined,
  });
  let historyFailure = false;
  const listener = actorsListener({ store: f.store, history });
  const historyListener: HttpListener = (request, response) => {
    if (historyFailure && request.url?.includes("/history")) {
      response.writeHead(500).end();
      return;
    }
    listener(request, response);
  };
  return {
    ...f,
    tasks,
    usage,
    history,
    historyListener,
    failHistory(value: boolean) {
      historyFailure = value;
    },
    async close() {
      for (const id of ["parcel", "waiting"]) await actors.release(`task:${id}`);
      router.stop();
      await f.close();
    },
  };
}
