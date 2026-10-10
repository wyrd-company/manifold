// ---
// relationships:
//   verifies: [decision-models, process-manifest, blueprint]
// ---
import { expect, test } from "vite-plus/test";
import { stringify } from "yaml";
import { lintDecisionModelSet } from "./process-manifest.ts";
import { lintBlueprint } from "./blueprint-lint.ts";
const model = {
  nodes: [
    { id: "in", type: "inputNode" },
    { id: "out", type: "outputNode" },
  ],
  edges: [{ id: "edge", sourceId: "in", targetId: "out" }],
};
test("set lint checks root paths before reading and locates missing roots", async () => {
  const reads: string[] = [];
  const read = async (path: string) => {
    reads.push(path);
    return undefined;
  };
  expect(await lintDecisionModelSet(read, "../x.yml")).toMatchObject({
    ok: false,
    findings: [{ kind: "model-key-invalid", file: "../x.yml", location: "" }],
  });
  expect(reads).toEqual([]);
  expect(await lintDecisionModelSet(read, "decision-models/quote.yml")).toMatchObject({
    ok: false,
    findings: [{ kind: "model-missing", file: "decision-models/quote.yml", location: "" }],
  });
});
test("set lint follows a nested model outside the invoke directory once", async () => {
  const root = {
    nodes: [
      ...model.nodes,
      { id: "nested", type: "decisionNode", content: { key: "shared/rates.yml" } },
    ],
    edges: [
      { id: "one", sourceId: "in", targetId: "nested" },
      { id: "two", sourceId: "nested", targetId: "out" },
    ],
  };
  const files: Record<string, string> = {
    "decision-models/quote.yml": stringify(root),
    "shared/rates.yml": stringify(model),
  };
  expect(
    await lintDecisionModelSet(async (path) => files[path], "decision-models/quote.yml"),
  ).toMatchObject({
    ok: true,
    models: { "decision-models/quote.yml": root, "shared/rates.yml": model },
  });
});
test("rule 13 checks invoked models without treating them as implementations", async () => {
  const path = "decision-models/quote.yml";
  const text = stringify({
    machine: {
      initial: "quote",
      states: {
        quote: { invoke: { src: path, onDone: "done", onError: "done" } },
        done: { type: "final" },
      },
    },
    schemas: { input: true, output: true, context: true, events: {} },
  });
  const names = {
    actors: new Set<string>(),
    actions: new Set<string>(),
    guards: new Set<string>(),
    delays: new Set<string>(),
  };
  expect((await lintBlueprint("blueprints/quote.yml", text, names)).ok).toBe(true);
  expect(
    await lintBlueprint("blueprints/quote.yml", text, names, { decisionModels: new Map() }),
  ).toMatchObject({
    ok: false,
    findings: [
      {
        kind: "decision-model",
        name: path,
        reason: "missing",
        location: "/machine/states/quote/invoke/src",
      },
    ],
  });
  expect(
    (
      await lintBlueprint("blueprints/quote.yml", text, names, {
        decisionModels: new Map([[path, []]]),
      })
    ).ok,
  ).toBe(true);
});
