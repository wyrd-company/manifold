// ---
// relationships:
//   verifies: [agent-threads, durable-event-delivery]
// ---
import { assign, createActor, createMachine } from "xstate";
import type { AnyActorRef, Snapshot } from "xstate";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openAgentThreads } from "../index.ts";
import type { AcceptedCommand } from "../index.ts";
import { openStore } from "../../store/index.ts";
import type { PersistedSnapshot, DeliveryTarget, StoredSnapshot } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import type { Router } from "../../router/index.ts";
import { startT3CodeSource, threadTopic } from "../../t3code-source/index.ts";
import type { EnvironmentsConfiguration, T3CodeSource } from "../../t3code-source/index.ts";
export interface FixtureConfiguration {
  path: string;
  token: string;
  environments: EnvironmentsConfiguration;
  crash?: "thread-create" | "turn-start";
  onSave?: (snapshot: PersistedSnapshot) => void;
  probe?: (command: AcceptedCommand) => void;
}
export function fixtureService(configuration: FixtureConfiguration) {
  const store = openStore({ path: configuration.path });
  const commit = "a".repeat(40);
  const actorId = "worker";
  let actor: AnyActorRef;
  let source: T3CodeSource;
  let router: Router;
  let attached = false;
  const module = openAgentThreads({
    environments: configuration.environments,
    tokenFile: () => configuration.token,
    invocationOf: (args) => ({ actorId, invokeId: args.self.id, entryId: "entry-one" }),
    actorOf: () => ({ manifold: actor.getSnapshot().context.manifold, commit }),
    bindingArchived: () => false,
    sourceReady: (environment, signal) => source.ready(environment, signal),
    revisionAt: async () =>
      memoryRevision(commit, { "templates/parcel.njk": "Process {{ parcel }}" }),
    probe(command) {
      configuration.probe?.(command);
      if (configuration.crash === command.implementation) process.kill(process.pid, "SIGKILL");
    },
  });
  const machine = createMachine(
    {
      id: "parcel",
      context: {
        manifold: { environment: "station", project: "binding", threads: [] as string[] },
        thread: "",
        message: "",
        started: 0,
      },
      initial: "working",
      states: {
        working: {
          initial: "opening",
          on: {
            "t3.turn.started": {
              guard: "own",
              actions: assign({ started: ({ context }) => context["started"] + 1 }),
            },
            "t3.turn.settled": { guard: "own", target: "done" },
          },
          states: {
            opening: {
              invoke: {
                id: "opening",
                src: "thread-create",
                input: {
                  project: "project",
                  title: "Parcel {{ parcel }}",
                  values: { parcel: "sample" },
                  model: { instanceId: "provider", model: "model" },
                  runtimeMode: "approval-required",
                },
                onDone: {
                  target: "preparing",
                  actions: [
                    "follow-thread",
                    assign({ thread: ({ event }) => event.output.threadId }),
                  ],
                },
              },
            },
            preparing: {
              invoke: {
                id: "preparing",
                src: "turn-prepare",
                onDone: {
                  target: "prompting",
                  actions: assign({ message: ({ event }) => event.output.messageId }),
                },
              },
            },
            prompting: {
              invoke: {
                id: "prompting",
                src: "turn-start",
                input: ({ context }) => ({
                  threadId: context["thread"],
                  messageId: context["message"],
                  prompt: "templates/parcel.njk",
                  values: { parcel: "sample" },
                }),
                onDone: "waiting",
              },
            },
            waiting: {},
          },
        },
        done: { type: "final" },
      },
    },
    {
      actors: module.implementations.actors,
      actions: module.implementations.actions as NonNullable<
        NonNullable<Parameters<typeof createMachine>[1]>["actions"]
      >,
      guards: {
        own: ({ context, event }) =>
          event["threadId"] === context["thread"] && event["messageId"] === context["message"],
      },
    },
  );
  function restore(stored?: StoredSnapshot): DeliveryTarget {
    actor = createActor(
      machine,
      stored ? { snapshot: stored.snapshot as Snapshot<unknown> } : { id: actorId },
    );
    const target: DeliveryTarget = {
      actorId,
      send: (row) => actor.send(row.payload),
      persist: () => ({
        machine: "parcel",
        snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
      }),
    };
    actor.subscribe(() => {
      if (attached) {
        router.persist(actorId);
        configuration.onSave?.(actor.getPersistedSnapshot() as PersistedSnapshot);
      }
    });
    return target;
  }
  router = startRouter({
    store,
    host: {
      subscription(record) {
        const context = record.snapshot["context"] as { manifold: { threads: string[] } };
        return {
          topics: context.manifold.threads.map((id) => threadTopic("station", id)),
          events: ["t3.turn.started", "t3.turn.settled"],
        };
      },
      restore(stored) {
        return { status: "restored", target: restore(stored) };
      },
    },
  });
  if (!store.loadSnapshot(actorId)) {
    const target = restore();
    router.attach(target);
  }
  attached = true;
  source = startT3CodeSource({
    store,
    router,
    environments: configuration.environments,
    tokenFile: () => configuration.token,
  });
  actor!.start();
  return {
    actor: actor!,
    source,
    router,
    store,
    async stop() {
      attached = false;
      actor.stop();
      await module.stop();
      await source.stop();
      router.stop();
      store.close();
    },
  };
}
