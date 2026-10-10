// ---
// relationships:
//   verifies: decision-models
// ---
import { expect, it } from "vite-plus/test";
import { lintDecisionModel } from "./decision-models.ts";

const table = (source: string) => ({
  nodes: [
    {
      id: "n/~",
      type: "customNode",
      content: {
        kind: "jsonataDecisionTable",
        config: {
          hitPolicy: "first",
          inputs: [{ id: "i", field: "item.value" }],
          outputs: [{ id: "o", field: "answer" }],
          rules: [{ _id: "r/~", i: source, o: "7" }],
        },
      },
    },
  ],
  edges: [],
});
it.each([
  "7",
  '"sample"',
  "null",
  "1+2",
  "1-2",
  "1*2",
  "1/2",
  "1%2",
  "-1",
  "[1..5]",
  "[]",
  '{"x":1}',
  '"a" & "b"',
  "true ? 2 : 3",
  "true ? 2",
  "(1; 2)",
])("warns on nonboolean input %s", (source) => {
  expect(lintDecisionModel(table(source), "sample")).toEqual([
    expect.objectContaining({
      kind: "never-boolean",
      severity: "warning",
      nodeId: "n/~",
      ruleId: "r/~",
      columnId: "i",
      location: "sample#/nodes/n~1~0/rules/r~1~0/i",
    }),
  ]);
});
it.each([
  "true",
  "false",
  "$ > 3",
  "$",
  "item.value",
  "$custom()",
  "$number($)",
  "true ? true : 3",
  "[true][0]",
])("does not classify %s", (source) =>
  expect(lintDecisionModel(table(source), "sample")).toEqual([]),
);
it("rejects syntax with precise locations in fields and both cell directions", () => {
  const m = table("> 3");
  m.nodes[0]!.content.config.outputs[0]!.field = "answer";
  m.nodes[0]!.content.config.rules[0]!.o = "> 3";
  m.nodes[0]!.content.config.inputs[0]!.field = "> 3";
  expect(lintDecisionModel(m, "sample").map((f) => [f.kind, f.columnId, f.code])).toEqual([
    ["syntax", "i", "S0211"],
    ["syntax", "i", "S0211"],
    ["syntax", "o", "S0211"],
  ]);
});
it.each(["switchNode", "decisionTableNode", "expressionNode", "functionNode", "other"])(
  "rejects authored %s",
  (type) =>
    expect(lintDecisionModel({ nodes: [{ id: "n", type }], edges: [] }, "sample")).toEqual([
      expect.objectContaining({ kind: "node-unsupported" }),
    ]),
);
it.each([
  null,
  {},
  { nodes: [{ id: "n", type: "decisionNode" }], edges: [] },
  {
    nodes: [
      {
        id: "n",
        type: "customNode",
        content: { kind: "jsonataSwitch", config: { hitPolicy: "other", statements: [] } },
      },
    ],
    edges: [],
  },
])("stops at malformed structure %j", (model) =>
  expect(lintDecisionModel(model, "sample").every((f) => f.kind === "structure")).toBe(true),
);
it("finds duplicate ids, output conflicts, and incompatible settings", () => {
  const m = table("true");
  const config = m.nodes[0]!.content.config;
  Object.assign(config, { executionMode: "loop", passThrough: true });
  config.outputs.push({ id: "o", field: "answer.deep" });
  config.rules.push({ ...config.rules[0]! });
  m.nodes.push(m.nodes[0]!);
  expect(lintDecisionModel(m, "sample").map((f) => f.kind)).toEqual(
    expect.arrayContaining([
      "duplicate-id",
      "output-field-conflict",
      "loop-needs-input-field",
      "pass-through-needs-object",
    ]),
  );
});
it("lints switch conditions, duplicate statements, handles and route collisions", () => {
  const model = {
    nodes: [
      {
        id: "s",
        type: "customNode",
        content: {
          kind: "jsonataSwitch",
          config: {
            hitPolicy: "first",
            statements: [
              { id: "a", condition: "7" },
              { id: "a", condition: "> 3" },
            ],
          },
        },
      },
      { id: "s~route", type: "inputNode", editorExtra: true },
    ],
    edges: [{ id: "e", sourceId: "s", targetId: "s~route", sourceHandle: "missing" }],
  };
  expect(lintDecisionModel(model, "sample").map((f) => f.kind)).toEqual([
    "duplicate-id",
    "duplicate-id",
    "switch-handle-unknown",
    "never-boolean",
    "syntax",
  ]);
});
it("ignores editor properties and unknown custom kinds are unsupported", () => {
  expect(
    lintDecisionModel(
      { nodes: [{ id: "n", type: "inputNode", editorExtra: true }], edges: [] },
      "sample",
    ),
  ).toEqual([]);
  expect(
    lintDecisionModel(
      {
        nodes: [{ id: "n", type: "customNode", content: { kind: "other", config: {} } }],
        edges: [],
      },
      "sample",
    ),
  ).toEqual([expect.objectContaining({ kind: "node-unsupported" })]);
});
it("rejects a blank expression node rather than treating it as a blank cell", () =>
  expect(
    lintDecisionModel(
      {
        nodes: [
          {
            id: "n",
            type: "customNode",
            content: { kind: "jsonataExpression", config: { expression: "  " } },
          },
        ],
        edges: [],
      },
      "sample",
    ),
  ).toEqual([expect.objectContaining({ kind: "syntax" })]));
it("allows column ids that are also Object prototype property names", () => {
  const model = {
    nodes: [
      {
        id: "n",
        type: "customNode",
        content: {
          kind: "jsonataDecisionTable",
          config: {
            hitPolicy: "first",
            inputs: [{ id: "toString" }],
            outputs: [{ id: "constructor", field: "answer" }],
            rules: [{ _id: "r" }],
          },
        },
      },
    ],
    edges: [],
  };
  expect(lintDecisionModel(model, "sample")).toEqual([]);
});
it.each([
  ["loop-needs-input-field", { executionMode: "loop" }],
  ["pass-through-needs-object", { hitPolicy: "collect", passThrough: true }],
  ["pass-through-needs-object", { executionMode: "loop", inputField: "items", passThrough: true }],
] as const)("rejects incompatible configuration %s %j", (kind, settings) => {
  const m = table("true");
  Object.assign(m.nodes[0]!.content.config, settings);
  expect(lintDecisionModel(m, "sample").map((f) => f.kind)).toEqual([kind]);
});
it.each(["node", "column", "rule"] as const)("detects a sole duplicate %s id", (where) => {
  const m = table("true");
  if (where === "node") m.nodes.push(m.nodes[0]!);
  if (where === "column") m.nodes[0]!.content.config.inputs.push({ id: "i", field: "other" });
  if (where === "rule")
    m.nodes[0]!.content.config.rules.push({ ...m.nodes[0]!.content.config.rules[0]! });
  expect(lintDecisionModel(m, "sample").map((f) => f.kind)).toEqual(["duplicate-id"]);
});
it.each(["answer", "answer.deep", "a"])("detects sole output field overlap %s", (field) => {
  const m = table("true");
  m.nodes[0]!.content.config.outputs[0]!.field = "answer";
  m.nodes[0]!.content.config.outputs.push({ id: "other", field });
  expect(lintDecisionModel(m, "sample").map((f) => f.kind)).toEqual(
    field === "a" ? [] : ["output-field-conflict"],
  );
});
it.each([
  {
    nodes: [
      {
        id: "s",
        type: "customNode",
        content: { kind: "jsonataSwitch", config: { hitPolicy: "first", statements: [{}] } },
      },
    ],
    edges: [],
  },
  {
    nodes: [
      {
        id: "t",
        type: "customNode",
        content: {
          kind: "jsonataDecisionTable",
          config: { hitPolicy: "first", inputs: [], outputs: [], rules: "other" },
        },
      },
    ],
    edges: [],
  },
  {
    nodes: [
      {
        id: "e",
        type: "customNode",
        content: { kind: "jsonataExpression", config: { expression: "true", extra: true } },
      },
    ],
    edges: [],
  },
])("reports structure and stops for malformed config %j", (model) => {
  const findings = lintDecisionModel(model, "sample");
  expect(findings.length).toBeGreaterThan(0);
  expect(findings.every((f) => f.kind === "structure")).toBe(true);
});
it("emits warnings only for predicate sites and stays pure across repeated lint", () => {
  const m = table("7");
  const before = JSON.stringify(m);
  expect(lintDecisionModel(m, "sample")).toEqual(lintDecisionModel(m, "sample"));
  expect(JSON.stringify(m)).toBe(before);
  const expression = {
    nodes: [
      {
        id: "e",
        type: "customNode",
        content: { kind: "jsonataExpression", config: { expression: "7" } },
      },
    ],
    edges: [],
  };
  expect(lintDecisionModel(expression, "sample")).toEqual([]);
});
