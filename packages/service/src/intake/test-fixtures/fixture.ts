// ---
// relationships:
//   verifies: intake
// ---
import { createActor } from "xstate";
import {
  memoryRevision,
  lintPortfolioDeclaration,
  parseBlueprintVersionKey,
} from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
import { openStore } from "../../store/index.ts";
import type { Store, DeliveryTarget, PersistedSnapshot } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import type { ActorHost, Router } from "../../router/index.ts";
import { createBlueprintLoader } from "../../blueprint-loader/index.ts";
import type { LoadedBlueprint } from "../../blueprint-loader/index.ts";
import type { TrackedIssue } from "../../github-source/index.ts";
import { intakeMigrationSteps, startIntake } from "../index.ts";
import type { IntakeOptions, IntakeRevision, TaskActorStarter } from "../index.ts";
export const first = "a".repeat(40),
  second = "b".repeat(40);
export const issue = (id = "I1"): TrackedIssue => ({
  issue: {
    nodeId: id,
    repository: "example-org/widgets",
    number: 7,
    state: "open",
    stateReason: null,
  },
  blockedBy: [],
  blocking: [],
  subIssues: [],
  parent: undefined,
  projects: [{ nodeId: "P1", owner: "example-org", number: 1 }],
  items: [
    {
      project: { nodeId: "P1", owner: "example-org", number: 1 },
      nodeId: "ITEM1",
      archived: false,
      fields: { Track: { kind: "single-select", optionId: "gear", name: "Gears" } },
    },
  ],
});
export const model = (expression?: string) => ({
  nodes: [
    { id: "in", type: "inputNode" },
    {
      id: "quote",
      type: "customNode",
      content:
        expression !== undefined
          ? { kind: "jsonataExpression", config: { expression } }
          : {
              kind: "jsonataDecisionTable",
              config: {
                hitPolicy: "first",
                inputs: [{ id: "track", field: "task.fields.Track.name" }],
                outputs: [
                  { id: "blueprint", field: "blueprint" },
                  { id: "item", field: "portfolioItem" },
                  { id: "data", field: "data" },
                ],
                rules: [
                  {
                    _id: "gears",
                    track: '$ = "Gears"',
                    blueprint: '"blueprints/parcel.yml"',
                    item: '"beta"',
                    data: '{"quote":7}',
                  },
                  {
                    _id: "other",
                    blueprint: '"blueprints/parcel.yml"',
                    item: '"gamma"',
                    data: "{}",
                  },
                ],
              },
            },
    },
    { id: "out", type: "outputNode" },
  ],
  edges: [
    { id: "a", sourceId: "in", targetId: "quote" },
    { id: "b", sourceId: "quote", targetId: "out" },
  ],
});
export const files = (expression?: string, input: unknown = true) => ({
  "manifold.yml": stringify({ intake: { decisionModel: "models/quote.yml" } }),
  "models/quote.yml": stringify(model(expression)),
  "blueprints/parcel.yml": stringify({
    machine: {
      id: "parcel",
      initial: "sorting",
      context: { seen: [] },
      states: {
        sorting: {
          on: {
            scanned: {
              actions: [
                {
                  type: "expression.assign",
                  params: { expression: '{"seen": [$append(seen, event.value)]}' },
                },
              ],
            },
          },
        },
        delivered: { type: "final" },
      },
    },
    schemas: {
      input,
      output: true,
      context: { type: "object" },
      events: { scanned: { type: "object" } },
    },
  }),
});
export function portfolio(commit = first, bindingItem = "alpha", archived = false) {
  const parsed = lintPortfolioDeclaration({
    portfolio: stringify({
      items: { alpha: { items: { beta: { archived }, gamma: {} } }, delta: {} },
    }),
    bindings: stringify({
      githubProjects: {
        first: { owner: "example-org", number: 1, environment: "env-one", item: bindingItem },
      },
    }),
  });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.findings));
  return { commit, declaration: parsed.declaration };
}
export function fixtureHost(
  store: Store,
  blueprints: Map<string, LoadedBlueprint>,
  afterAttach?: () => void,
) {
  let router: Router;
  const active: ReturnType<typeof createActor>[] = [];
  const starts: string[] = [];
  const inputs: unknown[] = [];
  function target(
    actorId: string,
    blueprint: LoadedBlueprint,
    input: unknown,
    snapshot?: PersistedSnapshot,
  ): DeliveryTarget {
    const actor = createActor(blueprint.machine, {
      input,
      ...(snapshot
        ? {
            snapshot: snapshot as Parameters<typeof createActor>[1] extends { snapshot?: infer S }
              ? S
              : never,
          }
        : {}),
    });
    actor.start();
    active.push(actor);
    // This is the ruled actor-host seam, while its owner is still in flight.
    if (!snapshot)
      (actor.getSnapshot().context as Record<string, unknown>)["manifold"] = (
        input as Record<string, unknown>
      )["manifold"];
    return {
      actorId,
      send: (row) => actor.send(row.payload as { type: string }),
      persist: () => ({
        machine: blueprint.key,
        snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
      }),
    };
  }
  const host: ActorHost & TaskActorStarter = {
    subscription(record) {
      const identity = (
        record.snapshot["context"] as { manifold: { issue: string; threads?: string[] } }
      ).manifold;
      return {
        topics: [
          `github.issue.${identity.issue}`,
          ...(identity.threads ?? []).map((id) => `t3code.thread.${id}`),
        ],
        ...(blueprints.has(record.machine)
          ? { events: Object.keys(blueprints.get(record.machine)!.document.schemas.events) }
          : {}),
      };
    },
    restore(stored) {
      const blueprint = blueprints.get(stored.machine);
      return blueprint
        ? {
            status: "restored",
            target: target(stored.actorId, blueprint, undefined, stored.snapshot),
          }
        : { status: "held", reason: "fixture version missing" };
    },
    start(request) {
      blueprints.set(request.blueprint.key, request.blueprint);
      starts.push(request.actorId);
      inputs.push(request.input);
      router.attach(target(request.actorId, request.blueprint, request.input));
      afterAttach?.();
    },
  };
  router = startRouter({ store, host });
  return {
    host,
    router,
    starts,
    inputs,
    stop() {
      router.stop();
      for (const actor of active) actor.stop();
    },
  };
}
export async function setup(
  path: string,
  source = files(),
  options: Partial<IntakeOptions> = {},
  commit = first,
) {
  const store = openStore({ path });
  store.connection.migrate("intake", intakeMigrationSteps);
  const revisions = new Map([
    [first, memoryRevision(first, files())],
    [commit, memoryRevision(commit, source)],
  ]);
  const loader = createBlueprintLoader({
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    revisionAt: async (c) => revisions.get(c),
    onExpressionError: (error) => {
      throw error;
    },
  });
  const loaded = await loader.loadRevision(revisions.get(commit)!);
  let current: IntakeRevision | undefined = {
    revision: revisions.get(commit)!,
    blueprints: loaded,
    portfolio: portfolio(commit),
  };
  const tracked = new Map<string, TrackedIssue>();
  const versions = new Map([...loaded.blueprints.values()].map((b) => [b.key, b]));
  for (const saved of store.activeSnapshots()) {
    const version = parseBlueprintVersionKey(saved.machine)!;
    const restored = await loader.version(version);
    if (restored.status === "loaded") versions.set(restored.blueprint.key, restored.blueprint);
  }
  const host = fixtureHost(store, versions);
  const errors: unknown[] = [];
  const intake = startIntake({
    store,
    tracked: { trackedIssue: (id) => tracked.get(id), trackedIssueIds: () => [...tracked.keys()] },
    blueprints: loader,
    current: () => current,
    actors: host.host,
    onError: (e) => errors.push(e),
    ...options,
  });
  tracked.set("I1", issue());
  return {
    store,
    loader,
    revisions,
    tracked,
    host,
    intake,
    errors,
    versions,
    current: () => current,
    setCurrent(value: IntakeRevision | undefined) {
      current = value;
    },
    async close() {
      await intake.stop();
      host.stop();
      store.close();
    },
  };
}
