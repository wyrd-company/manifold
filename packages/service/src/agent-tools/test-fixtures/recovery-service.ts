// ---
// relationships:
//   verifies: [agent-tools, actor-host, durable-event-delivery]
// ---
import { startGitHubSource } from "../../github-source/index.ts";
import { SecretValue } from "../../service-configuration/index.ts";
import { agentToolSteps } from "../migrations.ts";
import { stringify } from "yaml";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openStore } from "../../store/index.ts";
import type { Router } from "../../router/index.ts";
import type { Escalations } from "../../escalations/index.ts";
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
  issueTitle?: string;
  senderTask?: { repository: string; number: number; title?: string };
  senderIssue?: string | null;
  recipientIssue?: string;
  recipientThreads?: string[];
  githubUrl?: string;
  seedMessage?: boolean;
  identifyTimeoutMs?: number;
  held?: "different" | "unavailable" | "available";
  soleHeld?: boolean;
  noMessages?: boolean;
  ignoreMessage?: boolean;
  crash?: "escalate" | "handoff" | "answer-committed" | "answer-sent" | "message";
}
export async function recoveryService(config: RecoveryConfiguration) {
  const store = openStore({ path: config.path });
  if (config.seedMessage) {
    store.connection.migrate("agenttool", agentToolSteps);
    store.connection.database
      .prepare(
        "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,sender_issue,text,sent_at,delivered_at,delivered_to) VALUES (?, 'station', 'conversation', 'depot', 'shipment', 'The depot schedule changed.', 0, 1, 'parcel')",
      )
      .run("a".repeat(36));
  }
  let host: ActorHost;
  let source: T3CodeSource;
  let router: Router;
  let escalations: Escalations;
  const document = {
    machine: {
      id: "parcel",
      initial: "waiting",
      context: { answerTurn: null, answers: 0, handoffs: 0, messages: 0 },
      states: {
        waiting: {
          on: {
            ...(config.ignoreMessage || config.noMessages
              ? {}
              : {
                  "agent.message": {
                    actions: {
                      type: "expression.assign",
                      params: {
                        expression: '{"messages": context.messages + 1, "lastSender": event.from}',
                      },
                    },
                  },
                }),
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
        ...(config.noMessages ? {} : { "agent.message": true }),
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
    "blueprints/sender.yml": stringify(
      senderDocument(
        { environment: "station", threadId: "conversation" },
        "The depot schedule changed.",
      ),
    ),
  });
  const threads = openAgentThreads({
    environments: config.environments,
    tokenFile: () => config.token,
    actorOf: (id) => host.actorOf(id),
    invocationOf,
    bindingArchived: () => false,
    sourceReady: (name, signal) => source.ready(name, signal),
    sourcePlatform: (environment, signal) => source.platform(environment, signal),
    recordProject: (record) => source.recordCreatedProject(record),
    sourceWrite: (name, id, signal, send) => source.write(name, id, signal, send),
    revisionAt: async () => revision,
  });
  const issueReads: string[] = [];
  const tools = openAgentTools({
    trackedIssue: (nodeId) => {
      issueReads.push(nodeId);
      return config.githubUrl
        ? github!.trackedIssue(nodeId)?.issue
        : nodeId === "shipment"
          ? config.senderTask
          : nodeId === "shipment-recipient" && config.issueTitle !== undefined
            ? { repository: "example-org/widgets", number: 7, title: config.issueTitle }
            : undefined;
    },
    store,
    // Live caller identification uses the service default; deadline tests override it.
    configuration: { identifyTimeoutMs: config.identifyTimeoutMs ?? 3000 },
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
    sourceReady: (name) =>
      source.status().some((status) => status.environment === name && status.state === "following"),
    environmentId: (name, signal) => source.environmentId(name, signal),
    escalations: () => escalations,
    probe(call) {
      if (config.crash === call.tool) process.kill(process.pid, "SIGKILL");
    },
    log: () => {},
  });
  const loader = createBlueprintLoader({
    implementations: {
      ...threads.implementations,
      actors: { ...threads.implementations.actors, ...tools.implementations.actors },
    },
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
        context: {
          manifold: {
            issue: config.recipientIssue ?? "shipment-recipient",
            environment: "station",
            threads: config.recipientThreads ?? ["conversation"],
          },
        },
      },
    });
  }
  host = await openActorHost({
    store,
    blueprints: loader,
    saveHooks: [tools.saving],
    log: () => {},
  });
  router = startRouter({ store, host });
  const github = config.githubUrl
    ? startGitHubSource({
        store,
        router,
        configuration: {
          apiUrl: config.githubUrl,
          owners: { sample: { credential: "example", hooks: [] } },
          sweepIntervalMs: 900000,
          redeliveryIntervalMs: 60000,
          requestTimeoutMs: 30000,
        },
        credentials: {
          names: ["example"],
          resolve: () => ({
            kind: "github-app",
            name: "example",
            installationToken: async () => new SecretValue("example", "synthetic-token"),
          }),
        },
        boundProjects: () => [{ owner: "sample", number: 1 }],
        processRepository: {
          url: "https://example.test/sample/process.git",
          branch: "main",
          pull: async () => ({ kind: "unchanged", commit: revision.commit }),
        },
      })
    : undefined;
  escalations = openEscalations({
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
      input: {
        manifold: {
          issue: config.recipientIssue ?? "shipment-recipient",
          environment: "station",
          threads: config.recipientThreads ?? ["conversation"],
        },
      },
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
    github,
    issueReads,
    url: http.url,
    async send(
      to: unknown,
      text: unknown,
      senderId = "depot",
      entry = "announce",
      senderIssue = config.senderIssue,
      waitRemoval = false,
    ) {
      const sender = senderDocument(to, text, entry, waitRemoval);
      const sendingRevision = memoryRevision(revision.commit, {
        "blueprints/sender.yml": stringify(sender),
      });
      const sendingLoader = createBlueprintLoader({
        implementations: tools.implementations,
        revisionAt: async () => sendingRevision,
        onStateEntry: recordStateEntry,
        onExpressionError: (error) => {
          throw error;
        },
      });
      const loaded = await sendingLoader.version({
        commit: revision.commit,
        path: "blueprints/sender.yml",
      });
      if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
      host.start({
        actorId: senderId,
        blueprint: loaded.blueprint,
        input: {
          manifold: senderIssue === null ? {} : { issue: senderIssue ?? "shipment" },
        },
      });
      if (config.crash === "message") {
        // The invoke commits synchronously; its completion save is queued after this callback.
        queueMicrotask(() => process.kill(process.pid, "SIGKILL"));
      }
    },
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
      await github?.stop();
      await threads.stop();
      await source.stop();
      await escalations.stop();
      router.stop();
      store.close();
    },
  };
}

function senderDocument(to: unknown, text: unknown, entry = "announce", waitRemoval = false) {
  return {
    machine: {
      id: "sender",
      initial: waitRemoval ? "waiting" : "sending",
      context: {},
      states: {
        ...(waitRemoval ? { waiting: { on: { "github.project-item.removed": "sending" } } } : {}),
        sending: {
          invoke: {
            id: entry,
            src: "send-message",
            input: { to, text },
            onDone: {
              target: "sent",
              actions: {
                type: "expression.assign",
                params: { expression: '{"result": event.output}' },
              },
            },
            onError: {
              target: "failed",
              actions: {
                type: "expression.assign",
                params: { expression: '{"error": event.error}' },
              },
            },
          },
        },
        sent: { type: "final" },
        failed: { type: "final" },
      },
    },
    schemas: {
      input: true,
      output: true,
      context: true,
      events: waitRemoval ? { "github.project-item.removed": true } : {},
      actors: { "send-message": { input: true, output: true } },
    },
  };
}
