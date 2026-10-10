// ---
// relationships:
//   verifies: [blueprint-loader, decision-models]
// ---
import { expect, test, vi } from "vite-plus/test";
import { createActor, toPromise } from "xstate";
import { stringify } from "yaml";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { createBlueprintLoader } from "./index.ts";
const path = "decision-models/quote.yml";
const model = {
  nodes: [
    { id: "in", type: "inputNode" },
    {
      id: "calc",
      type: "customNode",
      content: { kind: "jsonataExpression", config: { expression: '{"price": size * 2}' } },
    },
    { id: "out", type: "outputNode" },
  ],
  edges: [
    { id: "one", sourceId: "in", targetId: "calc" },
    { id: "two", sourceId: "calc", targetId: "out" },
  ],
};
function fixture(input: unknown = { size: 3 }, source: string | undefined = stringify(model)) {
  const text = stringify({
    machine: {
      initial: "quoting",
      context: {},
      states: {
        quoting: {
          invoke: {
            id: "quote",
            src: path,
            input,
            onDone: {
              target: "done",
              actions: {
                type: "expression.assign",
                params: { expression: '{"answer": event.output}' },
              },
            },
            onError: {
              target: "done",
              actions: {
                type: "expression.assign",
                params: { expression: '{"error": event.error}' },
              },
            },
          },
        },
        done: {
          type: "final",
          output: { type: "expression.map", params: { expression: "context" } },
        },
      },
    },
    schemas: {
      input: true,
      output: true,
      context: true,
      events: {},
      actors: { [path]: { input: true, output: true } },
    },
  });
  const revision = memoryRevision("a".repeat(40), {
    "blueprints/quote.yml": text,
    ...(source === undefined ? {} : { [path]: source }),
  });
  const loader = createBlueprintLoader({
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    revisionAt: async () => revision,
    onExpressionError: vi.fn(),
  });
  return { loader, revision };
}
test("model invokes evaluate at their version and restore an in-flight invoke", async () => {
  const { loader, revision } = fixture();
  const loaded = await loader.loadRevision(revision);
  const blueprint = loaded.blueprints.get("blueprints/quote.yml");
  expect(blueprint).toBeDefined();
  if (!blueprint) throw new Error("Missing blueprint");
  expect(blueprint.actorKinds[path]).toBe("promise");
  const actor = createActor(blueprint.machine).start();
  const snapshot = actor.getPersistedSnapshot();
  actor.stop();
  expect(blueprint.checkRestore(snapshot)).toEqual({ ok: true });
  const restored = createActor(blueprint.machine, { snapshot }).start();
  expect(await toPromise(restored)).toEqual({ answer: { price: 6 } });
});
test.each([false, true])("model invokes take input and evaluation errors (%s)", async (failing) => {
  const { loader, revision } = fixture(
    failing ? { size: 3 } : 3,
    failing
      ? stringify({
          ...model,
          nodes: model.nodes.map((n) =>
            n.id === "calc"
              ? {
                  ...n,
                  content: {
                    kind: "jsonataExpression",
                    config: { expression: '$error("bad sample")' },
                  },
                }
              : n,
          ),
        })
      : stringify(model),
  );
  const load = await loader.loadRevision(revision);
  const bp = load.blueprints.get("blueprints/quote.yml");
  expect(bp).toBeDefined();
  if (!bp) throw new Error("Missing blueprint");
  const actor = createActor(bp.machine).start();
  expect(await toPromise(actor)).toMatchObject({
    error: { type: "decision-model", reason: failing ? "evaluation" : "input", path },
  });
});
test("missing and invalid model files fail the version with rule 13", async () => {
  for (const source of [undefined, "["]) {
    const f = fixture();
    const revision = memoryRevision("b".repeat(40), {
      "blueprints/quote.yml": (await f.revision.read("blueprints/quote.yml"))!,
      ...(source === undefined ? {} : { [path]: source }),
    });
    const load = await f.loader.loadRevision(revision);
    expect(load.failures.get("blueprints/quote.yml")).toMatchObject([
      { kind: "decision-model", name: path, reason: source === undefined ? "missing" : "invalid" },
    ]);
  }
});

test("historical and bundled blueprints bind the model files of their own commit and cache reads", async () => {
  const f = fixture();
  const blueprintText = (await f.revision.read("blueprints/quote.yml"))!;
  const newer = structuredClone(model);
  newer.nodes[1]!.content = {
    kind: "jsonataExpression",
    config: { expression: '{"price": size * 3}' },
  };
  const versions = new Map([
    ["a".repeat(40), f.revision],
    [
      "b".repeat(40),
      memoryRevision("b".repeat(40), {
        "blueprints/quote.yml": blueprintText,
        [path]: stringify(newer),
      }),
    ],
  ]);
  const read = vi.fn(f.revision.read);
  versions.set("a".repeat(40), { ...f.revision, read });
  const loader = createBlueprintLoader({
    implementations: { actors: {}, actions: {}, guards: {}, delays: {} },
    revisionAt: async (commit) => versions.get(commit),
    onExpressionError: vi.fn(),
    bundles: {
      current: {
        digest: "c".repeat(64),
        files: new Map([["blueprints/quote.yml", blueprintText]]),
      },
      at: () => ({
        digest: "c".repeat(64),
        files: new Map([["blueprints/quote.yml", blueprintText]]),
      }),
    },
  });
  for (const [commit, price, bundle] of [
    ["a".repeat(40), 6, undefined],
    ["b".repeat(40), 9, undefined],
    ["a".repeat(40), 6, "c".repeat(64)],
  ] as const) {
    const version = await loader.version({
      commit,
      path: "blueprints/quote.yml",
      ...(bundle ? { bundle } : {}),
    });
    expect(version.status).toBe("loaded");
    if (version.status !== "loaded") throw new Error("Missing blueprint");
    expect(await toPromise(createActor(version.blueprint.machine).start())).toEqual({
      answer: { price },
    });
  }
  expect(read.mock.calls.filter(([key]) => key === path)).toHaveLength(1);
});
