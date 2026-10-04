// ---
// relationships:
//   verifies: decision-models
//   references: zen-jsonata
// ---
import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { ZenEngine } from "@gorules/zen-engine";
import { decisionModelSchema } from "../../shared/src/decision-model-schema.ts";
import { lintDecisionModel } from "@wyrd-company/manifold-shared";
import { createDecisionModels, DecisionModelLoadError } from "./decision-models.ts";
const schema = parse(
  readFileSync(
    new URL("../../../docs/specifications/decision-models.schema.yml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
const checks = Object.fromEntries(
  [
    "decision-model",
    "decision-model-finding",
    "decision-model-error-detail",
    "decision-model-evaluation",
  ].map((def) => [
    def,
    ajv.compile({ ...schema, $id: `${schema.$id}/${def}`, $ref: `#/$defs/${def}` }),
  ]),
);
const check = (def: string, value: unknown) => {
  expect(checks[def]!(value), JSON.stringify(checks[def]!.errors)).toBe(true);
};
const graph = (expression: string) => ({
  nodes: [
    { id: "i", name: "i", type: "inputNode" },
    {
      id: "calc",
      name: "calc",
      type: "customNode",
      content: { kind: "jsonataExpression", config: { expression } },
    },
    { id: "o", name: "o", type: "outputNode" },
  ],
  edges: [
    { id: "a", sourceId: "i", targetId: "calc" },
    { id: "b", sourceId: "calc", targetId: "o" },
  ],
});
it("keeps the runtime schema equal to its authoritative YAML asset", () =>
  expect(decisionModelSchema).toEqual(schema));
it("validates fixture models, findings, details and records against the specification", async () => {
  for (const expression of ['{"value": 7}', "$notAFunction()", "function($x){$x}"]) {
    const model = graph(expression);
    check("decision-model", model);
    const models = createDecisionModels({ sample: model });
    try {
      const record = await models.evaluate("sample", { value: 4 });
      check("decision-model-evaluation", record);
      if (record.outcome === "error") check("decision-model-error-detail", record.error);
    } finally {
      models.dispose();
    }
  }
  for (const finding of lintDecisionModel(graph("> 3"), "sample"))
    check("decision-model-finding", finding);
});
it("contract-tests the native NodeError envelope and null failing trace data", async () => {
  const detail = { kind: "evaluation", model: "sample", nodeId: "calc", message: "failure" };
  const engine = new ZenEngine({
    customHandler: async () => {
      throw new Error(JSON.stringify(detail));
    },
  });
  try {
    await expect(
      engine.createDecision(graph("true")).evaluate({ value: 4 }, { trace: true }),
    ).rejects.toSatisfy((error: Error) => {
      const envelope = JSON.parse(error.message);
      expect(envelope).toMatchObject({
        type: "NodeError",
        nodeId: "calc",
        source: `Error: ${JSON.stringify(detail)}`,
        trace: { calc: { traceData: null }, i: { output: { value: 4 } } },
      });
      expect(envelope.trace.o).toBeUndefined();
      return true;
    });
  } finally {
    engine.dispose();
  }
});
it("preserves nested-model error identity and nested switch trace projection", async () => {
  const child = graph("$notAFunction()");
  const parent = {
    nodes: [
      { id: "i", name: "i", type: "inputNode" },
      { id: "child", name: "child", type: "decisionNode", content: { key: "child" } },
      { id: "o", name: "o", type: "outputNode" },
    ],
    edges: [
      { id: "a", sourceId: "i", targetId: "child" },
      { id: "b", sourceId: "child", targetId: "o" },
    ],
  };
  const models = createDecisionModels({ sample: parent, child });
  try {
    expect(await models.evaluate("sample", {})).toMatchObject({
      outcome: "error",
      error: { model: "child", nodeId: "calc", code: "T1006" },
    });
  } finally {
    models.dispose();
  }
});
it("aggregates load findings in model key order and retains warnings", () => {
  try {
    createDecisionModels({ z: graph("> 3"), a: graph("> 3") });
    throw new Error("accepted");
  } catch (error) {
    expect(error).toBeInstanceOf(DecisionModelLoadError);
    const findings = (error as DecisionModelLoadError).findings;
    expect(findings.map((f) => f.model)).toEqual(["a", "z"]);
    for (const f of findings) check("decision-model-finding", f);
  }
});
it("hides generated routing inside nested model traces", async () => {
  const child = {
    nodes: [
      { id: "i", name: "i", type: "inputNode" },
      {
        id: "switch",
        name: "switch",
        type: "customNode",
        content: {
          kind: "jsonataSwitch",
          config: { hitPolicy: "first", statements: [{ id: "yes", condition: "true" }] },
        },
      },
      { id: "o", name: "o", type: "outputNode" },
    ],
    edges: [
      { id: "a", sourceId: "i", targetId: "switch" },
      { id: "b", sourceId: "switch", sourceHandle: "yes", targetId: "o" },
    ],
  };
  const parent = {
    nodes: [
      { id: "i", name: "i", type: "inputNode" },
      { id: "child", name: "child", type: "decisionNode", content: { key: "child" } },
      { id: "o", name: "o", type: "outputNode" },
    ],
    edges: [
      { id: "a", sourceId: "i", targetId: "child" },
      { id: "b", sourceId: "child", targetId: "o" },
    ],
  };
  const models = createDecisionModels({ sample: parent, child });
  try {
    const result = await models.evaluate("sample", { value: 4 });
    expect(result).toMatchObject({ result: { value: 4 } });
    expect(JSON.stringify(result)).not.toMatch(/__manifoldSwitch|~route/);
  } finally {
    models.dispose();
  }
});
it.each(["parcel-quote.yml", "editor-export.yml"])(
  "loads and evaluates the YAML fixture %s",
  async (file) => {
    const content = readFileSync(
      new URL(`./decision-model-fixtures/${file}`, import.meta.url),
      "utf8",
    );
    const model = parse(content);
    if (file === "editor-export.yml") expect(model).toEqual(JSON.parse(content));
    check("decision-model", model);
    const models = createDecisionModels({ sample: model });
    try {
      const input = { parcel: { kg: 24 } };
      const result = await models.evaluate("sample", input);
      check("decision-model-evaluation", result);
      expect(result).toMatchObject({
        outcome: "result",
        result: file === "parcel-quote.yml" ? { rate: 36, service: "express" } : input,
      });
      if (file === "parcel-quote.yml") expect(result.trace["standard"]).toBeUndefined();
    } finally {
      models.dispose();
    }
  },
);
it("returns native engine failures as records and retains load warnings", async () => {
  const models = createDecisionModels({
    sample: {
      nodes: [
        { id: "i", type: "inputNode" },
        { id: "recursive", type: "decisionNode", content: { key: "sample" } },
        { id: "o", type: "outputNode" },
      ],
      edges: [
        { id: "a", sourceId: "i", targetId: "recursive" },
        { id: "b", sourceId: "recursive", targetId: "o" },
      ],
    },
  });
  try {
    expect(await models.evaluate("sample", {})).toMatchObject({
      outcome: "error",
      error: { kind: "engine", model: "sample" },
    });
  } finally {
    models.dispose();
  }
  const warned = createDecisionModels({
    sample: {
      nodes: [
        { id: "i", type: "inputNode" },
        {
          id: "s",
          type: "customNode",
          content: {
            kind: "jsonataSwitch",
            config: { hitPolicy: "first", statements: [{ id: "a", condition: "7" }] },
          },
        },
        { id: "o", type: "outputNode" },
      ],
      edges: [
        { id: "a", sourceId: "i", targetId: "s" },
        { id: "b", sourceId: "s", sourceHandle: "a", targetId: "o" },
      ],
    },
  });
  try {
    expect(warned.findings).toEqual([
      expect.objectContaining({ kind: "never-boolean", statementId: "a" }),
    ]);
  } finally {
    warned.dispose();
  }
});
