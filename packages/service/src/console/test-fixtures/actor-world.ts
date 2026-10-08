// ---
// relationships:
//   verifies: [operator-console, actor-usage-api]
// ---
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
import { boardWorld } from "../../tasks/test-fixtures/world.ts";
import { openTasks } from "../../tasks/index.ts";
import { openUsage, usageMigrationSteps } from "../../usage/index.ts";
import { createBlueprintLoader } from "../../blueprint-loader/index.ts";
import { openActorHost, recordStateEntry } from "../../actor-host/index.ts";
import { startRouter } from "../../router/index.ts";
import { actorSummaries } from "../actors-api.ts";
import type { HttpListener } from "../../http-host/index.ts";
const at = (n: number) => new Date(n * 1000).toISOString();
/** Recorded approved seam until the history owner merges. */
export async function actorWorld() {
  const f = boardWorld(true, false);
  let now = 0;
  f.store.connection.migrate("usage", usageMigrationSteps);
  const usage = openUsage({
    connection: f.store.connection,
    ledger: f.ledger,
    portfolio: { t3codeProject: () => ({ item: "other", via: "unbound" }) },
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
          waiting: { on: { collected: "packing" } },
          packing: { on: { delivered: "complete" } },
          complete: { type: "final" },
        },
      },
      schemas: {
        input: { type: "object" },
        context: { type: "object" },
        output: true,
        events: { collected: true, delivered: true },
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
    saveHooks: [usage.saveHook],
    log: () => {},
    now: () => now,
  });
  const router = startRouter({
    store: f.store,
    host: actors,
    clock: { now: () => now, setTimer: () => () => {} },
  });
  const send = async (id: string, type: string, n: number) => {
    now = n * 1000;
    router.publish({
      source: "github",
      eventId: `${id}-${type}`,
      topics: [`github.issue.${id}`],
      event: { type },
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
    await send(id, "collected", 1);
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
    if (id === "parcel") await send(id, "delivered", 7);
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
  const histories = () =>
    ["parcel", "waiting"].map((id) => {
      const active = id === "waiting",
        threadId = active ? "thread-2" : "thread-1",
        snapshot = f.store.loadSnapshot(`task:${id}`)!;
      const actor = { ...actorSummaries([snapshot])[0]!, status: active ? "active" : "done" };
      const events = [
        {
          eventId: "move-1",
          type: "github.project-item.field-changed",
          topic: "github.project.sample",
          receivedAt: at(1),
          consumedAt: at(1),
          visit: 1,
          payload: {
            field: { nodeId: "status-field", name: "Status" },
            to: { kind: "single-select", optionId: "packing", name: "Packing" },
            movedBy: { actorId: actor.actorId, confirmed: true },
          },
        },
        ...(active
          ? []
          : [
              {
                eventId: "handoff",
                type: "agent.handoff",
                topic: "agent.sample",
                receivedAt: at(7),
                consumedAt: at(7),
                visit: 2,
                payload: { environment: "sample-host", threadId, turnId: "turn-one" },
              },
              {
                eventId: "move-2",
                type: "github.project-item.field-changed",
                topic: "github.project.sample",
                receivedAt: at(8),
                consumedAt: at(8),
                visit: 3,
                payload: {
                  field: { nodeId: "status-field", name: "Status" },
                  to: { kind: "single-select", optionId: "delivered", name: "Delivered" },
                  movedBy: { actorId: actor.actorId, confirmed: true },
                },
              },
            ]),
      ];
      return {
        actor,
        visits: [
          {
            visit: 1,
            value: "waiting",
            states: ["waiting"],
            machine: snapshot.machine,
            enteredAt: at(0),
            exitedAt: at(1),
            exitEvent: { type: "github.project-item.field-changed", eventId: "move-1" },
          },
          {
            visit: 2,
            value: "packing",
            states: ["packing"],
            machine: snapshot.machine,
            enteredAt: at(1),
            ...(active
              ? {}
              : { exitedAt: at(7), exitEvent: { type: "agent.handoff", eventId: "handoff" } }),
          },
          ...(active
            ? []
            : [
                {
                  visit: 3,
                  value: "complete",
                  states: ["complete"],
                  machine: snapshot.machine,
                  enteredAt: at(7),
                },
              ]),
        ],
        events,
        commands: [
          {
            commandId: "create",
            kind: "thread-create",
            environment: "sample-host",
            threadId,
            invokeId: "create",
            entryId: "one",
            sentAt: at(0.01),
          },
          {
            commandId: "start",
            kind: "turn-start",
            environment: "sample-host",
            threadId,
            turnId: "turn-one",
            invokeId: "run",
            entryId: "one",
            sentAt: at(0.05),
          },
        ],
        ...(active ? {} : { end: { status: "done", endedAt: at(9) } }),
      };
    });
  let historyFailure = false;
  const historyListener: HttpListener = (request, response) => {
    if (historyFailure && request.url?.includes("/history")) {
      response.writeHead(500).end();
      return;
    }
    const path = (request.url ?? "").split("?")[0]!,
      match = /^\/api\/actors\/([^/]+)\/history$/.exec(path),
      all = histories();
    const body = match
      ? { history: all.find((h) => h.actor.actorId === decodeURIComponent(match[1]!)) }
      : {
          actors: all
            .filter((h) =>
              new URL(request.url ?? "", "http://example.test").searchParams.get("status") ===
              "completed"
                ? h.actor.status === "done"
                : h.actor.status === "active",
            )
            .map((h) => h.actor),
        };
    response
      .writeHead(match && !body.history ? 404 : 200, {
        "content-type": "application/json",
        "cache-control": "no-store",
      })
      .end(JSON.stringify(body));
  };
  return {
    ...f,
    tasks,
    usage,
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
