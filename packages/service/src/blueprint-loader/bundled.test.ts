// ---
// relationships:
//   verifies: [blueprint-loader, default-process]
// ---
import { expect, it } from "vite-plus/test";
import type { AnyActorRef } from "xstate";
import { createActor } from "xstate";
import { stringify } from "yaml";
import { bundleDigest, memoryRevision } from "@wyrd-company/manifold-shared";
import { createBlueprintLoader } from "./index.ts";
const commit = "a".repeat(40);
const child = (state: string) => ({
  machine: {
    initial: state,
    states: { [state]: { on: { scanned: "done" } }, done: { type: "final" } },
  },
  schemas: { input: true, output: true, context: true, events: {} },
});
it("replaces bundle paths with repository files, including invalid files, and pins bundled children", async () => {
  const files = new Map([
    [
      "blueprints/parent.yml",
      stringify({
        machine: {
          initial: "packing",
          states: {
            packing: { invoke: { src: "blueprints/child.yml", onDone: "done" } },
            done: { type: "final" },
          },
        },
        schemas: { input: true, output: true, context: true, events: {} },
      }),
    ],
    ["blueprints/child.yml", stringify(child("shipped"))],
  ]);
  const bundle = { digest: bundleDigest(files), files };
  let revision = memoryRevision(commit, {});
  const loader = createBlueprintLoader({
    bundles: { current: bundle, at: (digest) => (digest === bundle.digest ? bundle : undefined) },
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    revisionAt: async () => revision,
    onExpressionError: (error) => {
      throw error;
    },
  });
  const initial = await loader.loadRevision(revision);
  expect(initial.failures.size).toBe(0);
  expect(initial.blueprints.size).toBe(2);
  expect(initial.blueprints.get("blueprints/parent.yml")!.version.bundle).toBe(bundle.digest);
  revision = memoryRevision("b".repeat(40), { "blueprints/child.yml": stringify(child("custom")) });
  const replaced = await loader.loadRevision(revision);
  expect(replaced.blueprints.get("blueprints/child.yml")!.version.bundle).toBeUndefined();
  const parent = replaced.blueprints.get("blueprints/parent.yml")!;
  const actor = createActor(parent.machine).start();
  expect((Object.values(actor.getSnapshot().children)[0] as AnyActorRef)?.getSnapshot().value).toBe(
    "shipped",
  );
  actor.stop();
  revision = memoryRevision("c".repeat(40), { "blueprints/child.yml": "broken" });
  const invalid = await loader.loadRevision(revision);
  expect(invalid.failures.has("blueprints/child.yml")).toBe(true);
  expect(invalid.blueprints.has("blueprints/child.yml")).toBe(false);
  expect(
    await loader.version({ commit, path: "blueprints/child.yml", bundle: "d".repeat(64) }),
  ).toEqual({ status: "missing", reason: "bundle" });
});
it("restores a bundled version after an upgrade without using replacement text", async () => {
  const oldFiles = new Map([["blueprints/parcel.yml", stringify(child("packing"))]]);
  const newFiles = new Map([["blueprints/parcel.yml", stringify(child("routing"))]]);
  const oldBundle = { files: oldFiles, digest: bundleDigest(oldFiles) };
  const newBundle = { files: newFiles, digest: bundleDigest(newFiles) };
  const revision = memoryRevision(commit, { "blueprints/parcel.yml": stringify(child("custom")) });
  const loader = createBlueprintLoader({
    bundles: {
      current: newBundle,
      at: (digest) =>
        digest === oldBundle.digest
          ? oldBundle
          : digest === newBundle.digest
            ? newBundle
            : undefined,
    },
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    revisionAt: async (id) => (id === commit ? revision : undefined),
    onExpressionError: (error) => {
      throw error;
    },
  });
  const restored = await loader.version({
    commit,
    path: "blueprints/parcel.yml",
    bundle: oldBundle.digest,
  });
  expect(restored.status).toBe("loaded");
  if (restored.status !== "loaded") throw new Error("Old bundle is unavailable");
  const actor = createActor(restored.blueprint.machine).start();
  expect(actor.getSnapshot().value).toBe("packing");
  expect(restored.blueprint.checkRestore(actor.getPersistedSnapshot()).ok).toBe(true);
  actor.stop();
  expect(
    await loader.version({
      commit: "b".repeat(40),
      path: "blueprints/parcel.yml",
      bundle: oldBundle.digest,
    }),
  ).toEqual({ status: "missing", reason: "commit" });
});
it("detects cycles in the bundled source even when the repository replaces a child", async () => {
  const parent = "blueprints/parent.yml",
    childPath = "blueprints/child.yml";
  const invoking = (path: string) => ({
    machine: {
      initial: "packing",
      states: {
        packing: { invoke: { id: "child", src: path, onDone: "done" } },
        done: { type: "final" },
      },
    },
    schemas: { input: true, output: true, context: true, events: {} },
  });
  const files = new Map([
    [parent, stringify(invoking(childPath))],
    [childPath, stringify(invoking(parent))],
  ]);
  const bundle = { files, digest: bundleDigest(files) };
  const revision = memoryRevision(commit, { [childPath]: stringify(child("custom")) });
  const loader = createBlueprintLoader({
    bundles: { current: bundle, at: () => bundle },
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    revisionAt: async () => revision,
    onExpressionError: (error) => {
      throw error;
    },
  });
  const loaded = await loader.version({ commit, path: parent, bundle: bundle.digest });
  expect(loaded.status).toBe("loaded");
  if (loaded.status !== "loaded") throw new Error("Parent fixture failed");
  const actor = createActor(loaded.blueprint.machine);
  actor.subscribe({ error: () => {} });
  actor.start();
  try {
    await expect.poll(() => actor.getSnapshot().status).toBe("error");
    expect(actor.getSnapshot().error).toEqual({
      type: "child-blueprint",
      path: childPath,
      reason: "cycle",
    });
  } finally {
    actor.stop();
  }
});
