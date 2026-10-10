// ---
// relationships:
//   verifies: [decision-models, declarations-api, operator-console]
// ---
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "yaml";
import { expect, test } from "vite-plus/test";
import { isDecisionModelEvaluateResponse, isDrawableDecisionModel } from "./decision-model-api.ts";
test("browser validators agree with the schema and need no runtime compilation", () => {
  const schema = parse(
    readFileSync(
      new URL("../../../docs/specifications/decision-models.schema.yml", import.meta.url),
      "utf8",
    ),
  );
  const source = readFileSync(new URL("./decision-model-validators.js", import.meta.url), "utf8");
  expect(source.split("\n").find((line) => line.startsWith("// Schema digest:"))).toBe(
    "// Schema digest: " + createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
  );
  expect(source).not.toMatch(/require\(|new Function|eval\(/);
  expect(
    isDecisionModelEvaluateResponse({
      evaluation: {
        model: "sample.yml",
        input: {},
        trace: {},
        outcome: "result",
        result: { value: 3 },
      },
    }),
  ).toBe(true);
  expect(
    isDecisionModelEvaluateResponse({
      evaluation: {
        model: "sample.yml",
        input: {},
        trace: {},
        outcome: "error",
        error: {
          model: "sample.yml",
          kind: "evaluation",
          message: "sample error",
          nodeId: "table",
          ruleId: "one",
          columnId: "price",
        },
      },
    }),
  ).toBe(true);
  expect(isDecisionModelEvaluateResponse({ evaluation: { outcome: "result", result: 3 } })).toBe(
    false,
  );
  expect(
    isDrawableDecisionModel({
      nodes: [
        { id: "in", type: "inputNode" },
        { id: "unsupported", type: "decisionTableNode", content: {} },
        { id: "out", type: "outputNode" },
      ],
      edges: [],
    }),
  ).toBe(true);
  expect(
    isDrawableDecisionModel({
      nodes: [
        { id: "table", type: "customNode", content: { kind: "jsonataDecisionTable", config: {} } },
      ],
      edges: [],
    }),
  ).toBe(false);
});
