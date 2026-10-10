// ---
// relationships:
//   verifies: [operator-console, decision-models]
// ---
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { writeModel, prepareModel } from "./decision-model-text.ts";
import { modelSummary } from "./decision-model-summary.ts";
const text =
  '# graph\nmetadata: { keep: yes }\nnodes:\n  # input comment\n  - id: in\n    type: inputNode\n  - id: table\n    type: customNode\n    content:\n      kind: jsonataDecisionTable\n      config:\n        hitPolicy: first\n        inputs: [{ id: a, name: Size, field: size }]\n        outputs: [{ id: b, name: Price, field: price }]\n        rules:\n          # first rule\n          - _id: first\n            a: $ > 1\n            b: "5"\n          - _id: second\n            a: $ > 2\n            b: "9"\n  # output comment\n  - id: out\n    type: outputNode\nedges: []\n';
test("unchanged model and filled layout round-trip byte for byte", () => {
  expect(writeModel(text, parse(text))).toBe(text);
  const prepared = prepareModel(parse(text));
  expect(writeModel(text, prepared.authored(prepared.model))).toBe(text);
});
test("changed cells, rule ordering, removed rules and columns preserve comments and unknown data", () => {
  const model = parse(text);
  const config = model.nodes[1].content.config;
  config.rules.reverse();
  config.rules[0].b = "12";
  config.inputs.push({ id: "c", name: "Weight", field: "weight" });
  delete model.metadata;
  const next = writeModel(text, model);
  expect(next).toContain("# input comment");
  expect(next).toContain("# output comment");
  expect(next).toContain("# first rule");
  expect(parse(next).metadata).toEqual({ keep: "yes" });
  expect(parse(next).nodes[1].content.config).toEqual(config);
  config.rules.splice(1, 1);
  expect(parse(writeModel(next, model)).nodes[1].content.config.rules).toHaveLength(1);
});
test("summaries read table rule counts, policy and named inputs, including models with findings", () => {
  expect(modelSummary(text)).toMatchObject({
    nodes: 3,
    tables: [{ id: "table", hitPolicy: "first", rules: 2, inputs: ["Size"] }],
  });
  expect(modelSummary("[")).toBeUndefined();
  expect(modelSummary("nodes: [{id: in, type: inputNode}]\nedges: []")).toEqual({
    nodes: 1,
    tables: [],
  });
});

test("stock editor optional undefined values remain absent rather than becoming YAML null", () => {
  const prepared = prepareModel(parse(text));
  const node = prepared.model.nodes[1]!;
  node.content.config = {
    ...node.content.config,
    inputField: undefined,
    outputPath: undefined,
    executionMode: "single",
    passThrough: false,
  };
  const next = writeModel(text, prepared.authored(prepared.model));
  expect(parse(next).nodes[1].content.config).not.toHaveProperty("inputField");
  expect(parse(next).nodes[1].content.config).not.toHaveProperty("outputPath");
});

test("table summaries show three tables and writing stock JSON exports preserves other node comments", () => {
  const model = parse(text);
  for (let i = 0; i < 3; i++)
    model.nodes.push({ ...structuredClone(model.nodes[1]), id: `table-${i}`, name: `Table ${i}` });
  expect(modelSummary(JSON.stringify(model))?.tables).toHaveLength(4);
  const config = model.nodes[1].content.config;
  config.outputs.push({ id: "extra", name: "Extra", field: "extra" });
  config.inputs[0].name = "Parcel size";
  config.rules.push({ _id: "third", a: "$ > 3", b: "15", extra: "0" });
  const next = writeModel(text, JSON.parse(JSON.stringify(model)));
  expect(parse(next).nodes[1].content.config).toEqual(config);
  expect(next).toContain("# output comment");
  expect(next).toContain("# input comment");
  config.outputs.splice(0, 1);
  for (const rule of config.rules) delete rule.b;
  expect(parse(writeModel(next, model)).nodes[1].content.config.outputs).toEqual([
    { id: "extra", name: "Extra", field: "extra" },
  ]);
});
