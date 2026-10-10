// ---
// relationships:
//   verifies: [task-metadata, github-event-source]
// ---
import { expect, test } from "vite-plus/test";
import { memoryRevision, scopeKey } from "@wyrd-company/manifold-shared";
import { openStore } from "../store/index.ts";
import { openTaskMetadata, taskMetadataMigrationSteps } from "../task-metadata/index.ts";
import type { ScopeConfiguration } from "../github-source/index.ts";
import type { SaveRequest } from "../process-repository/index.ts";
import { repositoryFixture } from "./test-fixtures/repository.ts";

test.each(["label", "milestone"] as const)(
  "%s Accept stays pending through saved and already-saved until the declaration is in force",
  async (kind) => {
    const h = await repositoryFixture();
    const store = openStore({ path: ":memory:" });
    store.connection.migrate("metadata", taskMetadataMigrationSteps);
    const scopes = new Map<string, ScopeConfiguration>();
    const saves: SaveRequest[] = [];
    const bindings =
      "githubProjects: {parcels: {owner: sample, number: 1, environment: local, item: shipments}}";
    const text =
      "projects: {parcels: {lifecycle: {field: Stage, options: [Packed]}, repositories: [sample/depot], fields: {size: {type: single-select, storage: {kind: label, prefix: 'size: '}, whenChanged: accept, options: [Small, Large]}, batch: {type: single-select, storage: {kind: milestone}, whenChanged: accept, options: [Spring]}}}}";
    const fields = {
      projectNodeId: "P_one",
      readAt: 1,
      fields: [
        {
          nodeId: "F_stage",
          name: "Stage",
          type: "single-select" as const,
          options: [{ id: "O_packed", name: "Packed", color: "gray" as const, description: "" }],
        },
      ],
    };
    const metadata = openTaskMetadata({
      connection: store.connection,
      actorOf: () => undefined,
      invocationOf: () => ({ actorId: "parcel", invokeId: "size", entryId: "entry" }),
      source: async () => ({
        project: () => ({ nodeId: "P_one", owner: "sample", number: 1 }),
        projectByNumber: () => ({ nodeId: "P_one", owner: "sample", number: 1 }),
        moveCard: async () => {},
        projectFields: () => fields,
        observeProjectFields: async () => fields,
        writeProjectField: async () => {
          throw new Error("Unexpected Project write");
        },
        scopeConfiguration: (scope) => scopes.get(scopeKey(scope)),
        observeScope: async (scope) => {
          const observed = await h.adapters.observeScope(scope);
          scopes.set(scopeKey(scope), observed);
          return observed;
        },
        writeScopeEntity: h.adapters.writeScopeEntity,
      }),
      bindingOf: () => "parcels",
      bindings: () => [
        {
          binding: "parcels",
          owner: "sample",
          number: 1,
          environment: "local",
          portfolioItem: "shipments",
        },
      ],
      revisions: {
        save: async (request) => {
          saves.push(request);
          return {
            outcome: saves.length === 1 ? ("saved" as const) : ("already-saved" as const),
            commit: "b".repeat(40),
            blueprints: undefined,
          };
        },
      },
    });
    try {
      await metadata.apply(
        memoryRevision("a".repeat(40), { "task-metadata.yml": text, "bindings.yml": bindings }),
      );
      await metadata.projects.apply("parcels", { removeUndeclared: false });
      await h.adapters.writeScopeEntity(
        kind === "label"
          ? {
              kind: "label-update",
              repository: "sample/depot",
              nodeId: "L_small",
              name: "size: Tiny",
            }
          : { kind: "milestone-update", repository: "sample/depot", number: 1, title: "Summer" },
      );
      const mutations = () => h.calls.filter((call) => call.method !== "GET").length;
      const before = mutations();
      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(
          metadata.projects.apply("parcels", { removeUndeclared: false }),
        ).rejects.toMatchObject({
          status: 409,
          kind: "declaration-pending",
          detail: { commit: "b".repeat(40) },
        });
        expect(metadata.projects.list()[0]?.lastApplied?.commit).toBe("a".repeat(40));
        expect((await metadata.projects.plan("parcels")).changes).toMatchObject([
          { storage: kind, side: "declaration", drift: true },
        ]);
        expect(mutations()).toBe(before);
      }
      expect(saves).toHaveLength(2);
      expect(saves[1]!.saveId).toBe(saves[0]!.saveId);
      await metadata.apply(
        memoryRevision("b".repeat(40), {
          "task-metadata.yml": saves[0]!.files[0]!.text,
          "bindings.yml": bindings,
        }),
      );
      expect(await metadata.projects.apply("parcels", { removeUndeclared: false })).toMatchObject({
        writes: 0,
        configuration: { state: "in-sync" },
      });
      expect(mutations()).toBe(before);
      expect(saves).toHaveLength(2);
    } finally {
      await metadata.close();
      store.close();
      await h.close();
    }
  },
);
