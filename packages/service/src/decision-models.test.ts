// ---
// relationships:
//   verifies: decision-models
//   references: zen-jsonata
// ---
import { expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { createDecisionModels, DecisionModelLoadError } from "./decision-models.ts";
const node = (id: string, kind: string, config: object) => ({
  id,
  name: id,
  type: "customNode",
  content: { kind, config },
});
const graph = (nodes: object[]) => ({
  nodes: [
    { id: "input", name: "input", type: "inputNode" },
    ...nodes,
    { id: "output", name: "output", type: "outputNode" },
  ],
  edges: ["input", ...nodes.map((n) => (n as { id: string }).id), "output"]
    .slice(1)
    .map((targetId, i) => ({
      id: `e${i}`,
      sourceId: ["input", ...nodes.map((n) => (n as { id: string }).id)][i],
      targetId,
    })),
});
const table = (source: string | null | undefined, policy = "first") =>
  node("table", "jsonataDecisionTable", {
    hitPolicy: policy,
    inputs: [{ id: "condition", field: "item.value" }],
    outputs: [{ id: "answer", field: "result.value" }],
    rules: [
      {
        _id: "candidate",
        ...(source === undefined ? {} : { condition: source }),
        answer: '"matched"',
      },
    ],
  });
async function run(model: object, input: Record<string, unknown> = {}) {
  const models = createDecisionModels({ sample: model });
  try {
    return await models.evaluate("sample", input);
  } finally {
    models.dispose();
  }
}
it.each(["first", "collect"])("strict true-only cells under %s", async (policy) => {
  for (const [source, value] of [
    ["true", true],
    ["false", false],
    ["null", null],
    ["0", 0],
    ['""', ""],
    ["$missing", undefined],
    ["[1,2]", [1, 2]],
    ["[]", []],
    ['{"x":1}', { x: 1 }],
    ["7", 7],
    ['"sample"', "sample"],
  ] as const) {
    const result = await run(graph([table(source, policy)]), { item: { value } });
    expect(result.outcome).toBe("result");
    expect("result" in result && result.result).toEqual(
      source === "true"
        ? policy === "first"
          ? { result: { value: "matched" } }
          : [{ result: { value: "matched" } }]
        : policy === "first"
          ? {}
          : [],
    );
  }
});
it.each(["first", "collect"])("binds column, whole input and blanks under %s", async (policy) => {
  for (const source of ["", "  ", null, undefined, "$ = 4 and $input.other = 9"])
    expect(
      await run(graph([table(source, policy)]), { item: { value: 4 }, other: 9 }),
    ).toMatchObject({
      outcome: "result",
      result:
        policy === "first" ? { result: { value: "matched" } } : [{ result: { value: "matched" } }],
    });
  expect(
    await run(graph([table("$exists($) = false and $input.other = 9", policy)]), { other: 9 }),
  ).toMatchObject({
    outcome: "result",
    result:
      policy === "first" ? { result: { value: "matched" } } : [{ result: { value: "matched" } }],
  });
});
it("writes nested outputs and omits blank/no-result parents", async () => {
  const model = graph([
    node("table", "jsonataDecisionTable", {
      hitPolicy: "first",
      inputs: [],
      outputs: [
        { id: "a", field: "result.value" },
        { id: "b", field: "blank.deep" },
        { id: "c", field: "missing.deep" },
        { id: "d", field: "nil" },
      ],
      rules: [
        {
          _id: "r",
          a: '{"number": other, "whole": $.item.value}',
          b: " ",
          c: "$missing",
          d: "null",
        },
      ],
    }),
  ]);
  const evaluation = await run(model, { item: { value: 4 }, other: 9 });
  expect(evaluation.outcome).toBe("result");
  expect("result" in evaluation && evaluation.result).toEqual({
    result: { value: { number: 9, whole: 4 } },
    nil: null,
  });
});
it("applies looping, paths, pass-through, and repeat evaluations without mutation", async () => {
  const model = parse(
    `nodes:\n  - {id: input, type: inputNode}\n  - id: calc\n    type: customNode\n    content:\n      kind: jsonataExpression\n      config: {expression: '$ * 2', executionMode: loop, inputField: values, outputPath: result.values, passThrough: true}\n  - {id: output, type: outputNode}\nedges:\n  - {id: a, sourceId: input, targetId: calc}\n  - {id: b, sourceId: calc, targetId: output}\n`,
  );
  const original = JSON.stringify(model);
  const input = { values: [2, 3], result: { keep: 9 } };
  const models = createDecisionModels({ sample: model });
  try {
    for (let i = 0; i < 2; i++)
      expect(await models.evaluate("sample", input)).toMatchObject({
        input,
        outcome: "result",
        result: { values: [2, 3], result: { keep: 9, values: [4, 6] } },
      });
  } finally {
    models.dispose();
  }
  expect(JSON.stringify(model)).toBe(original);
});
it.each(["condition", "answer"])(
  "enriches failing %s cell and stops downstream nodes",
  async (column) => {
    const t = table("true");
    const config = t.content.config as { rules: Record<string, string>[] };
    config.rules[0]![column] = "$notAFunction($)";
    const result = await run(graph([t]), { item: { value: 4 } });
    expect(result).toMatchObject({
      outcome: "error",
      error: {
        kind: "evaluation",
        model: "sample",
        nodeId: "table",
        ruleId: "candidate",
        columnId: column,
        code: "T1006",
      },
      trace: { table: { traceData: { error: { columnId: column } } } },
    });
    expect(result.trace["output"]).toBeUndefined();
  },
);
it.each(["function($x){$x}", '{"f":function($x){$x}}'])(
  "rejects function output %s",
  async (expression) =>
    expect(await run(graph([node("calc", "jsonataExpression", { expression })]))).toMatchObject({
      outcome: "error",
      error: { kind: "result", nodeId: "calc" },
    }),
);
it("reports invalid loop and pass-through results", async () => {
  expect(
    await run(
      graph([
        node("calc", "jsonataExpression", {
          expression: "$",
          executionMode: "loop",
          inputField: "missing",
        }),
      ]),
    ),
  ).toMatchObject({ error: { kind: "result" } });
  expect(
    await run(graph([node("calc", "jsonataExpression", { expression: "7", passThrough: true })])),
  ).toMatchObject({ error: { kind: "result" } });
});
it("loads nested models and fails missing references or malformed models", async () => {
  const child = graph([node("calc", "jsonataExpression", { expression: '{"value": 9}' })]);
  const parent = graph([
    { id: "child", name: "child", type: "decisionNode", content: { key: "child" } },
  ]);
  const models = createDecisionModels({ sample: parent, child });
  try {
    expect(await models.evaluate("sample", {})).toMatchObject({ result: { value: 9 } });
    await expect(models.evaluate("absent", {})).rejects.toThrow();
  } finally {
    models.dispose();
  }
  expect(() => createDecisionModels({ sample: parent })).toThrow(DecisionModelLoadError);
  expect(() => createDecisionModels({ sample: {} })).toThrow(DecisionModelLoadError);
});

const switched = (conditions: (string | null | undefined)[], policy = "first") => {
  const s = node("route", "jsonataSwitch", {
    hitPolicy: policy,
    statements: conditions.map((condition, i) => ({ id: `branch${i}`, condition })),
  });
  const branches = conditions.map((_, i) =>
    node(`branch${i}`, "jsonataExpression", {
      expression: `{"branch${i}": {"previous": $nodes.route, "ids": $keys($nodes), "whole": $}}`,
    }),
  );
  return {
    nodes: [
      { id: "input", name: "input", type: "inputNode" },
      s,
      ...branches,
      { id: "output", name: "output", type: "outputNode" },
    ],
    edges: [
      { id: "start", sourceId: "input", targetId: "route" },
      ...branches.flatMap((b, i) => [
        { id: `to${i}`, sourceId: "route", sourceHandle: `branch${i}`, targetId: b.id },
        { id: `out${i}`, sourceId: b.id, targetId: "output" },
      ]),
    ],
  };
};
it.each(["first", "collect"])(
  "routes only JSONata matches and hides generated switch details under %s",
  async (policy) => {
    const model = switched(
      ["7", "$input.value = 4", "true", policy === "collect" ? "false" : "$notAFunction()"],
      policy,
    );
    const result = await run(model, { value: 4 });
    expect(result.outcome).toBe("result");
    expect(result.trace["branch0"]).toBeUndefined();
    expect(result.trace["branch1"]).toBeDefined();
    expect(!!result.trace["branch2"]).toBe(policy === "collect");
    expect(result.trace["route"]).toMatchObject({
      traceData: {
        statements:
          policy === "first" ? [{ id: "branch1" }] : [{ id: "branch1" }, { id: "branch2" }],
      },
    });
    expect(result).toMatchObject({
      result: { branch1: { previous: { value: 4 }, ids: ["input", "route"], whole: { value: 4 } } },
    });
    expect(JSON.stringify(result)).not.toMatch(/__manifoldSwitch|~route/);
  },
);
it.each(["first", "collect"])(
  "takes every default only when no nonblank statement matches under %s",
  async (policy) => {
    const model = switched(["", null, "false", undefined], policy);
    const result = await run(model);
    expect(result.trace["route"]).toMatchObject({
      traceData: { statements: [{ id: "branch0" }, { id: "branch1" }, { id: "branch3" }] },
    });
    expect(result.trace["branch2"]).toBeUndefined();
    const matched = await run(switched(["", null, "true"], policy));
    expect(matched.trace["branch0"]).toBeUndefined();
    expect(matched.trace["branch2"]).toBeDefined();
  },
);
it("returns switch errors with statement identity and no generated nodes", async () => {
  const result = await run(switched(["$notAFunction()"]));
  expect(result).toMatchObject({
    outcome: "error",
    error: { kind: "evaluation", nodeId: "route", statementId: "branch0", code: "T1006" },
  });
  expect(JSON.stringify(result)).not.toMatch(/__manifoldSwitch|~route/);
});
it("projects switches from a later failing cell partial trace", async () => {
  const model = switched(["true"]);
  const t = table("$notAFunction()");
  model.nodes.splice(3, 0, t);
  model.edges.find((e) => e.id === "out0")!.targetId = "table";
  model.edges.push({ id: "finish", sourceId: "table", targetId: "output" });
  const result = await run(model, { value: 4 });
  expect(result).toMatchObject({
    outcome: "error",
    error: { nodeId: "table", ruleId: "candidate", columnId: "condition" },
  });
  expect(JSON.stringify(result)).not.toMatch(/__manifoldSwitch|~route/);
});
it("honors first/collect rule order, short-circuits failed cells and ignores unmatched output errors", async () => {
  for (const hitPolicy of ["first", "collect"]) {
    const t = node("table", "jsonataDecisionTable", {
      hitPolicy,
      inputs: [{ id: "a" }, { id: "b" }],
      outputs: [{ id: "o", field: "value" }],
      rules: [
        { _id: "skip", a: "false", b: "$notAFunction()", o: "$notAFunction()" },
        { _id: "one", a: "true", o: "1" },
        { _id: "two", o: "2" },
      ],
    });
    const result = await run(graph([t]));
    expect(result).toMatchObject({
      result: hitPolicy === "first" ? { value: 1 } : [{ value: 1 }, { value: 2 }],
    });
    expect(result.trace["table"]).toMatchObject({
      traceData:
        hitPolicy === "first"
          ? { index: 1, rule: { _id: "one" } }
          : [
              { index: 1, rule: { _id: "one" } },
              { index: 2, rule: { _id: "two" } },
            ],
    });
  }
});
it("distinguishes null expression result from no result", async () => {
  expect(
    await run(
      graph([node("calc", "jsonataExpression", { expression: "null", outputPath: "value" })]),
    ),
  ).toMatchObject({ result: { value: null } });
  expect(
    await run(graph([node("calc", "jsonataExpression", { expression: "$absent" })])),
  ).toMatchObject({ result: {} });
});
it("evaluates the complete table/expression/switch graph from a JSON editor export saved as YAML", async () => {
  const model = switched(["quote.rate > 10", "true"]);
  const t = node("table", "jsonataDecisionTable", {
    hitPolicy: "first",
    inputs: [{ id: "weight", field: "parcel.kg" }],
    outputs: [{ id: "rate", field: "quote.rate" }],
    rules: [
      { _id: "heavy", weight: "$ > 20", rate: "parcel.kg * 1.5" },
      { _id: "any", rate: "10" },
    ],
  });
  const calc = node("calc", "jsonataExpression", { expression: "$", passThrough: true });
  model.nodes.splice(1, 0, t, calc);
  model.edges.find((e) => e.id === "start")!.sourceId = "calc";
  model.edges.push(
    { id: "toTable", sourceId: "input", targetId: "table" },
    { id: "toCalc", sourceId: "table", targetId: "calc" },
  );
  const exported = JSON.stringify(model);
  const result = await run(parse(exported), { parcel: { kg: 24 } });
  expect(result).toMatchObject({
    outcome: "result",
    result: { branch0: { previous: { quote: { rate: 36 } } } },
  });
  expect(result.trace["branch1"]).toBeUndefined();
});
it("keeps a loaded snapshot independent of later caller edits", async () => {
  const model = graph([
    node("calc", "jsonataExpression", { expression: "null", outputPath: "value" }),
  ]);
  const models = createDecisionModels({ sample: model });
  model.nodes.splice(0);
  try {
    expect(await models.evaluate("sample", {})).toMatchObject({ result: { value: null } });
  } finally {
    models.dispose();
  }
});
it.each(["first", "collect"])(
  "stops either cell direction with trace identity under %s",
  async (hitPolicy) => {
    for (const column of ["condition", "answer"]) {
      const t = table("true", hitPolicy);
      (t.content.config as { rules: Record<string, string>[] }).rules[0]![column] =
        "$notAFunction()";
      expect(await run(graph([t]))).toMatchObject({
        outcome: "error",
        error: { kind: "evaluation", columnId: column },
        trace: { table: { traceData: { error: { columnId: column } } } },
      });
    }
  },
);
it("reports a field evaluation failure and an output function at their own locations", async () => {
  const t = node("table", "jsonataDecisionTable", {
    hitPolicy: "first",
    inputs: [{ id: "c", field: "$notAFunction()" }],
    outputs: [],
    rules: [],
  });
  expect(await run(graph([t]))).toMatchObject({
    outcome: "error",
    error: { columnId: "c", location: "sample#/nodes/table/inputs/c/field" },
  });
  const output = node("table", "jsonataDecisionTable", {
    hitPolicy: "first",
    inputs: [],
    outputs: [{ id: "c", field: "value" }],
    rules: [{ _id: "r", c: "function($x){$x}" }],
  });
  expect(await run(graph([output]))).toMatchObject({
    outcome: "error",
    error: { kind: "result", ruleId: "r", columnId: "c" },
  });
});
it("uses missing inputField as null and blank input fields as the whole input", async () => {
  expect(
    await run(
      graph([
        node("e", "jsonataExpression", {
          expression: "$ = null",
          inputField: "missing",
          outputPath: "value",
        }),
      ]),
    ),
  ).toMatchObject({ result: { value: true } });
  const t = node("table", "jsonataDecisionTable", {
    hitPolicy: "first",
    inputs: [{ id: "c", field: " " }],
    outputs: [{ id: "o", field: "value" }],
    rules: [{ _id: "r", c: "$.number = 4", o: "$input.number" }],
  });
  expect(await run(graph([t]), { number: 4 })).toMatchObject({
    result: { value: 4 },
    trace: { table: { traceData: { reference_map: { c: { number: 4 } } } } },
  });
});
it("loops a table per element and wraps collected output for pass-through", async () => {
  const t = node("table", "jsonataDecisionTable", {
    hitPolicy: "collect",
    executionMode: "loop",
    inputField: "items",
    outputPath: "answers",
    passThrough: true,
    inputs: [{ id: "c", field: "value" }],
    outputs: [{ id: "o", field: "value" }],
    rules: [{ _id: "r", c: "$ > 2", o: "value * 2" }],
  });
  expect(await run(graph([t]), { items: [{ value: 1 }, { value: 4 }] })).toMatchObject({
    result: { items: [{ value: 1 }, { value: 4 }], answers: [[], [{ value: 8 }]] },
    trace: {
      table: { traceData: [[], [{ index: 0, rule: { _id: "r" }, reference_map: { c: 4 } }]] },
    },
  });
});
it("supports prototype property names as column ids and dotted output paths", async () => {
  const t = node("table", "jsonataDecisionTable", {
    hitPolicy: "first",
    inputs: [{ id: "toString" }],
    outputs: [{ id: "constructor", field: "constructor.value" }],
    rules: [{ _id: "r", constructor: "7" }],
  });
  const result = await run(graph([t]));
  expect(result).toMatchObject({
    outcome: "result",
    result: JSON.parse('{"constructor":{"value":7}}'),
  });
  expect(({} as Record<string, unknown>)["value"]).toBeUndefined();
});
it("first policy never evaluates a later matching rule", async () => {
  const t = node("table", "jsonataDecisionTable", {
    hitPolicy: "first",
    inputs: [],
    outputs: [{ id: "o", field: "value" }],
    rules: [
      { _id: "first", o: "7" },
      { _id: "later", o: "$notAFunction()" },
    ],
  });
  expect(await run(graph([t]))).toMatchObject({ outcome: "result", result: { value: 7 } });
});
