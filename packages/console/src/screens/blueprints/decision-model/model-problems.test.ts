// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { modelProblem } from "./model-problems.ts";
import { prepareModel } from "./decision-model-text.ts";
test("model problems name and locate cells, expressions, settings and switch statements", () => {
  const model = prepareModel({
    nodes: [
      {
        id: "table",
        name: "Quote",
        type: "customNode",
        content: {
          kind: "jsonataDecisionTable",
          config: { inputs: [{ id: "size", name: "Size" }], rules: [{ _id: "one" }] },
        },
      },
      {
        id: "expression",
        name: "Total",
        type: "customNode",
        content: { kind: "jsonataExpression", config: {} },
      },
      {
        id: "switch",
        type: "customNode",
        content: {
          kind: "jsonataSwitch",
          config: { statements: [{ id: "branch", condition: "true" }] },
        },
      },
    ],
    edges: [],
  }).model;
  const finding = {
    file: "sample.yml",
    location: "",
    kind: "decision-model",
    message: "Sample finding",
  };
  expect(
    modelProblem(
      { ...finding, finding: { nodeId: "table", ruleId: "one", columnId: "size" } },
      model,
    ),
  ).toEqual({
    nodeId: "table",
    column: "Size",
    label: "Size JSONata rule 1",
    description: "Quote · rule 1 · Size · Sample finding",
  });
  expect(modelProblem({ ...finding, finding: { nodeId: "expression" } }, model).label).toBe(
    "JSONata expression",
  );
  expect(
    modelProblem({ ...finding, finding: { nodeId: "expression", location: "/inputField" } }, model)
      .label,
  ).toBe("Input field");
  expect(
    modelProblem({ ...finding, finding: { nodeId: "switch", statementId: "branch" } }, model).label,
  ).toBe("Condition 1");
});
