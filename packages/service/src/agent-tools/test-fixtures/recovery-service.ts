// ---
// relationships:
//   verifies: [agent-tools, actor-host, durable-event-delivery]
// ---
import { stringify } from "yaml";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openStore } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import { openActorHost, invocationOf, recordStateEntry } from "../../actor-host/index.ts";
import type { ActorHost } from "../../actor-host/index.ts";
import { createBlueprintLoader } from "../../blueprint-loader/index.ts";
import { openAgentThreads } from "../../agent-threads/index.ts";
import { startT3CodeSource } from "../../t3code-source/index.ts";
import type { EnvironmentsConfiguration, T3CodeSource } from "../../t3code-source/index.ts";
import { openEscalations } from "../../escalations/index.ts";
import { openAgentTools } from "../index.ts";
import { serve } from "../../escalations/test-support.ts";
export interface RecoveryConfiguration {
  path: string;
  token: string;
  environments: EnvironmentsConfiguration;
  identifyTimeoutMs?: number;
  held?: "different" | "unavailable" | "available";
  soleHeld?: boolean;
  crash?: "handoff" | "answer-committed" | "answer-sent";
}
export async function recoveryService(config: RecoveryConfiguration) {
  const store = openStore({ path: config.path });
  let host: ActorHost;
  let source: T3CodeSource;
  const document = {
    machine: {
      id: "parcel",
      initial: "waiting",
      context: { answerTurn: null, answers: 0, handoffs: 0 },
      states: {
        waiting: {
          on: {
            "agent.handoff": {
              actions: {
                type: "expression.assign",
                params: { expression: '{"handoffs": context.handoffs + 1}' },
              },
            },
            "agent.escalation.answered": {
              actions: {
                type: "expression.assign",
                params: {
                  expression: '{"answerTurn": event.turnId, "answers": context.answers + 1}',
                },
              },
            },
            "t3.turn.settled": {
              guard: {
                type: "expression.guard",
                params: { expression: "event.turnId = context.answerTurn" },
              },
              target: "done",
            },
          },
        },
        done: { type: "final" },
      },
    },
    schemas: {
      input: true,
      output: true,
      context: true,
      actors: {},
      events: {
        "agent.handoff": {
          type: "object",
          required: ["handoff"],
          properties: {
            handoff: {
              type: "object",
              required: ["outcome"],
              properties: { outcome: { const: "sorted" } },
            },
          },
        },
        "agent.escalated": true,
        "agent.escalation.answered": true,
        "t3.turn.started": true,
        "t3.turn.settled": true,
      },
    },
  };
  const heldDocument = structuredClone(document);
  heldDocument.schemas.events["agent.handoff"].properties.handoff.properties.outcome.const =
    config.held === "different" ? "boxed" : "sorted";
  const revision = memoryRevision("a".repeat(40), {
    "blueprints/parcel.yml": stringify(document),
    "blueprints/held.yml": stringify(heldDocument),
  });
  const threads = openAgentThreads({
    environments: config.environments,
    tokenFile: () => config.token,
    actorOf: (id) => host.actorOf(id),
    invocationOf,
    bindingArchived: () => false,
    sourceReady: (name, signal) => source.ready(name, signal),
    sourceWrite: (name, id, signal, send) => source.write(name, id, signal, send),
    revisionAt: async () => revision,
  });
  const loader = createBlueprintLoader({
    implementations: threads.implementations,
    revisionAt: async () => revision,
    onStateEntry: recordStateEntry,
    onExpressionError: (error) => {
      throw error;
    },
  });
  const loaded = await loader.version({ commit: revision.commit, path: "blueprints/parcel.yml" });
  if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
  if (config.held) {
    const held = await loader.version({ commit: revision.commit, path: "blueprints/held.yml" });
    if (held.status !== "loaded") throw new Error(JSON.stringify(held));
    store.saveSnapshot({
      actorId: "held-follower",
      machine: config.held === "unavailable" ? "missing-version" : held.blueprint.key,
      snapshot: {
        status: "active",
        value: "missing-state",
        context: { manifold: { environment: "station", threads: ["conversation"] } },
      },
    });
  }
  host = await openActorHost({ store, blueprints: loader, saveHooks: [], log: () => {} });
  const router = startRouter({ store, host });
  const tools = openAgentTools({
    store,
    configuration: { identifyTimeoutMs: config.identifyTimeoutMs ?? 100 },
    environments: new Set(["station"]),
    router: () => router,
    actors: () => host,
    threads: {
      readThread: threads.readThread,
      runningThreads: threads.runningThreads,
      async startTurn(request) {
        const receipt = await threads.startTurn(request);
        if (config.crash === "answer-sent") process.kill(process.pid, "SIGKILL");
        return receipt;
      },
    },
    environmentId: (name, signal) => source.environmentId(name, signal),
    escalations: () => escalations,
    probe(call) {
      if (config.crash === "handoff" && call.tool === "handoff")
        process.kill(process.pid, "SIGKILL");
    },
    log: () => {},
  });
  const escalations = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "agent-question": (question) => {
        if (config.crash === "answer-committed") process.kill(process.pid, "SIGKILL");
        return tools.questionHandler(question);
      },
    },
  });
  source = startT3CodeSource({
    store,
    router,
    environments: config.environments,
    tokenFile: () => config.token,
    messagePlaced: tools.messagePlaced,
  });
  if (!config.soleHeld)
    host.start({
      actorId: "parcel",
      blueprint: loaded.blueprint,
      input: { manifold: { environment: "station", threads: ["conversation"] } },
    });
  escalations.start();
  tools.start();
  await source.ready("station");
  const http = await serve(tools.requestListener);
  return {
    store,
    host,
    escalations,
    source,
    snapshot: () => store.loadSnapshot("parcel")!.snapshot,
    async call(tool: string, args: unknown, meta: Record<string, unknown> = {}) {
      const response = await fetch(http.url + "/api/agent-tools/calls", {
        method: "POST",
        body: JSON.stringify({ environment: "station", tool, arguments: args, meta }),
      });
      return (await response.json()) as Record<string, unknown>;
    },
    async stop() {
      await http.close();
      await tools.stop();
      await threads.stop();
      await source.stop();
      await escalations.stop();
      router.stop();
      store.close();
    },
  };
}
