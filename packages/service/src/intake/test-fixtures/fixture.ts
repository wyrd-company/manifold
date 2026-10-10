// ---
// relationships:
//   verifies: intake
// ---
import { memoryRevision, lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
import { stringify } from "yaml";
import { openStore } from "../../store/index.ts";
import type { Store } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import { createBlueprintLoader } from "../../blueprint-loader/index.ts";
import type { BlueprintLoader } from "../../blueprint-loader/index.ts";
import { openActorHost, recordStateEntry } from "../../actor-host/index.ts";
import type { TrackedIssue } from "../../github-source/index.ts";
import { openEscalations } from "../../escalations/index.ts";
import type { Intake } from "../index.ts";
import { intakeFailedHandler, intakeMigrationSteps, startIntake } from "../index.ts";
import type { IntakeOptions, IntakeRevision } from "../index.ts";
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
export async function testActorHost(
  store: Store,
  blueprints: BlueprintLoader,
  afterStart?: () => void,
) {
  const host = await openActorHost({ store, blueprints, saveHooks: [], log: () => {} });
  const starts: string[] = [];
  const inputs: unknown[] = [];
  const start = host.start;
  host.start = (request) => {
    start(request);
    starts.push(request.actorId);
    inputs.push(request.input);
    afterStart?.();
  };
  const router = startRouter({ store, host });
  return { host, router, starts, inputs, stop: () => router.stop() };
}
export async function setup(
  path: string,
  source = files(),
  options: Partial<IntakeOptions> = {},
  commit = first,
  initiallyTracked?: readonly TrackedIssue[],
) {
  const store = openStore({ path });
  store.connection.migrate("intake", intakeMigrationSteps);
  const revisions = new Map([
    [first, memoryRevision(first, files())],
    [commit, memoryRevision(commit, source)],
  ]);
  const loader = createBlueprintLoader({
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    onStateEntry: recordStateEntry,
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
  const tracked = new Map((initiallyTracked ?? []).map((issue) => [issue.issue.nodeId, issue]));
  const host = await testActorHost(store, loader);
  const errors: unknown[] = [];
  let intake: Intake;
  const escalations = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "held-actor": () => {},
      "stranded-token": () => {},
      "comparator-failed": () => {},
      "intake-failed": intakeFailedHandler(store, (id) => intake?.discovered([id])),
    },
  });
  escalations.start();
  intake = startIntake({
    escalations,
    store,
    tracked: { trackedIssue: (id) => tracked.get(id), trackedIssueIndex: () => new Map(tracked) },
    blueprints: loader,
    current: () => current,
    actors: host.host,
    onError: (e) => errors.push(e),
    ...options,
  });
  if (!initiallyTracked) tracked.set("I1", issue());
  return {
    store,
    loader,
    revisions,
    tracked,
    host,
    intake,
    escalations,
    errors,
    current: () => current,
    setCurrent(value: IntakeRevision | undefined) {
      current = value;
    },
    async close() {
      await intake.stop();
      await escalations.stop();
      host.stop();
      store.close();
    },
  };
}
