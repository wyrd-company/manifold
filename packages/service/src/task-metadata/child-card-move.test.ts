// ---
// relationships:
//   verifies: [task-metadata, actor-host]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { expect, test } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { openStore } from "../store/index.ts";
import { openActorHost, invocationOf, recordStateEntry } from "../actor-host/index.ts";
import type { ActorHost } from "../actor-host/index.ts";
import { startRouter } from "../router/index.ts";
import { createBlueprintLoader } from "../blueprint-loader/index.ts";
import { openTaskMetadata, taskMetadataMigrationSteps } from "./index.ts";
test("a child card move uses the root identity and the child's state entry invocation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "child-card-move-"));
  const store = openStore({ path: join(directory, "store.sqlite") });
  let host: ActorHost;
  let childEntry: string | undefined;
  let rootEntry: string | undefined;
  let childIdentity: unknown = "unset";
  const moves: unknown[] = [];
  store.connection.migrate("metadata", taskMetadataMigrationSteps);
  const metadata = openTaskMetadata({
    connection: store.connection,
    actorOf: (id) => host.actorOf(id),
    invocationOf,
    source: async () => ({
      project: () => ({ nodeId: "P_one", owner: "sample", number: 1 }),
      moveCard: async (value) => {
        moves.push(value);
      },
    }),
    bindingOf: () => "parcels",
  });
  const schemas = {
    input: true,
    output: true,
    context: true,
    events: {},
    actors: { "github-card-move": { input: true, output: true } },
  };
  const revision = memoryRevision("a".repeat(40), {
    "bindings.yml":
      "githubProjects: { parcels: { owner: sample, number: 1, environment: local, item: shipments } }",
    "task-metadata.yml":
      "projects: { parcels: { lifecycle: { field: Stage, options: [Packed] } } }",
    "blueprints/root.yml": stringify({
      schemas,
      machine: {
        initial: "waiting",
        states: {
          waiting: { invoke: { id: "child", src: "blueprints/child.yml", onDone: "done" } },
          done: { type: "final" },
        },
      },
    }),
    "blueprints/child.yml": stringify({
      schemas,
      machine: {
        initial: "packing",
        states: {
          packing: {
            entry: "observe-child",
            invoke: {
              id: "stage",
              src: "github-card-move",
              input: { status: "Packed" },
              onDone: "done",
            },
          },
          done: { type: "final" },
        },
      },
    }),
  });
  const loader = createBlueprintLoader({
    implementations: {
      ...metadata.implementations,
      actions: {
        "observe-child": ({ context }: { context: Record<string, unknown> }) => {
          childIdentity = context["manifold"];
        },
      },
    },
    revisionAt: async () => revision,
    onExpressionError: () => {},
    onStateEntry: recordStateEntry,
  });
  let router: ReturnType<typeof startRouter> | undefined;
  try {
    await metadata.apply(revision);
    const loaded = await loader.version({ commit: revision.commit, path: "blueprints/root.yml" });
    expect(loaded.status).toBe("loaded");
    if (loaded.status !== "loaded") throw new Error(JSON.stringify(loaded));
    host = await openActorHost({
      store,
      blueprints: loader,
      saveHooks: [
        (save) => {
          childEntry ??= save.activeInvokes.find((invoke) => invoke.invokeId === "stage")?.entryId;
          rootEntry ??= save.activeInvokes.find((invoke) => invoke.invokeId === "child")?.entryId;
        },
      ],
      log: () => {},
    });
    router = startRouter({ store, host });
    host.start({
      actorId: "parcel",
      blueprint: loaded.blueprint,
      input: { manifold: { project: "P_one", issue: "I_A" } },
    });
    await expect.poll(() => moves.length).toBe(1);
    expect(childIdentity).toBeUndefined();
    expect(childEntry).toBeDefined();
    expect(childEntry).not.toBe(rootEntry);
    expect(moves[0]).toMatchObject({
      actorId: "parcel",
      invokeId: "stage",
      entryId: childEntry,
      projectNodeId: "P_one",
      issueNodeId: "I_A",
      field: "Stage",
      option: "Packed",
    });
    await expect.poll(() => store.loadSnapshot("parcel")?.snapshot.status).toBe("done");
  } finally {
    router?.stop();
    store.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
