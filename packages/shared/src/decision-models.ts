// ---
// relationships:
//   implements: decision-models
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { compileExpression, ExpressionError } from "./expressions.ts";
import { decisionModelSchema } from "./decision-model-schema.ts";
import { decisionModelBlank, decisionModelLocation } from "./decision-model-types.ts";
import type {
  DecisionModel,
  DecisionModelFinding,
  DecisionModelLocation,
} from "./decision-model-types.ts";
export type * from "./decision-model-types.ts";
let decisionModelValidator: ValidateFunction | undefined;
function validator() {
  return (decisionModelValidator ??= new Ajv2020({ allErrors: true, strict: false }).compile({
    ...decisionModelSchema,
    $ref: "#/$defs/decision-model",
  }));
}
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export type DecisionExpressionSite = DecisionModelLocation & {
  location: string;
  expression: string;
  boolean: boolean;
};
export function collectDecisionModelExpressions(
  model: DecisionModel,
  key: string,
): DecisionExpressionSite[] {
  const sites: DecisionExpressionSite[] = [];
  for (const node of model.nodes) {
    if (node.type !== "customNode") continue;
    const add = (
      source: string | null | undefined,
      boolean: boolean,
      segments: string[],
      extra: Partial<DecisionModelLocation> = {},
      skipBlank = true,
    ) => {
      if (!skipBlank || !decisionModelBlank(source))
        sites.push({
          model: key,
          nodeId: node.id,
          ...extra,
          location: decisionModelLocation(key, "nodes", node.id, ...segments),
          expression: source!,
          boolean,
        });
    };
    const { kind, config } = node.content;
    if (kind === "jsonataExpression") add(config.expression, false, ["expression"], {}, false);
    else if (kind === "jsonataSwitch")
      for (const s of config.statements)
        add(s.condition, true, ["statements", s.id], { statementId: s.id });
    else {
      for (const c of config.inputs)
        add(c.field, false, ["inputs", c.id, "field"], { columnId: c.id });
      for (const r of config.rules)
        for (const [columns, boolean] of [
          [config.inputs, true],
          [config.outputs, false],
        ] as const)
          for (const c of columns)
            add(Object.hasOwn(r, c.id) ? r[c.id] : undefined, boolean, ["rules", r._id, c.id], {
              ruleId: r._id,
              columnId: c.id,
            });
    }
  }
  return sites;
}
function neverBoolean(value: unknown): boolean {
  if (
    !object(value) ||
    ["predicate", "stages", "group", "focus"].some((k) => value[k] !== undefined)
  )
    return false;
  const type = value["type"],
    v = value["value"];
  if (type === "number" || type === "string" || (type === "value" && v === null)) return true;
  if (type === "binary") return ["+", "-", "*", "/", "%", "&", ".."].includes(String(v));
  if (type === "unary") return ["-", "[", "{"].includes(String(v));
  if (type === "block" && Array.isArray(value["expressions"]))
    return neverBoolean(value["expressions"].at(-1));
  if (type === "condition")
    return (
      neverBoolean(value["then"]) && (value["else"] === undefined || neverBoolean(value["else"]))
    );
  return false;
}
export function lintDecisionModel(model: unknown, key: string): readonly DecisionModelFinding[] {
  const findings: DecisionModelFinding[] = [];
  const unsupported: DecisionModelFinding[] = [];
  let checked = model;
  if (object(model) && Array.isArray(model["nodes"]))
    checked = {
      ...model,
      nodes: model["nodes"].map((n) => {
        if (!object(n)) return n;
        const content = n["content"];
        if (
          typeof n["type"] === "string" &&
          (!["inputNode", "outputNode", "decisionNode", "customNode"].includes(n["type"]) ||
            (n["type"] === "customNode" &&
              object(content) &&
              typeof content["kind"] === "string" &&
              !["jsonataDecisionTable", "jsonataExpression", "jsonataSwitch"].includes(
                content["kind"],
              )))
        ) {
          unsupported.push({
            severity: "error",
            kind: "node-unsupported",
            model: key,
            ...(typeof n["id"] === "string"
              ? { nodeId: n["id"], location: decisionModelLocation(key, "nodes", n["id"]) }
              : {}),
            message: "Node type or custom kind is not supported",
          });
          return { ...n, type: "inputNode", content: {} };
        }
        return n;
      }),
    };
  const validate = validator();
  if (!validate(checked))
    return (validate.errors ?? []).map((e) => ({
      severity: "error",
      kind: "structure",
      model: key,
      message: e.message ?? e.keyword,
      instancePath: e.instancePath,
    }));
  findings.push(...unsupported);
  const graph = checked as DecisionModel;
  const add = (
    kind: DecisionModelFinding["kind"],
    nodeId: string,
    message: string,
    extra: Partial<DecisionModelFinding> = {},
  ) =>
    findings.push({
      severity: "error",
      kind,
      model: key,
      nodeId,
      location: decisionModelLocation(key, "nodes", nodeId),
      message,
      ...extra,
    });
  const duplicate = (
    ids: string[],
    nodeId: string,
    extra: (id: string) => Partial<DecisionModelFinding> = () => ({}),
  ) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) add("duplicate-id", nodeId, `Duplicate id: ${id}`, extra(id));
      seen.add(id);
    }
  };
  const seen = new Set<string>();
  for (const node of graph.nodes) {
    if (seen.has(node.id)) add("duplicate-id", node.id, "Duplicate node id");
    seen.add(node.id);
    if (node.type !== "customNode") continue;
    const { kind, config } = node.content;
    if (kind === "jsonataSwitch") {
      if (graph.nodes.some((n) => n.id === `${node.id}~route`))
        add("duplicate-id", node.id, "Generated routing node id already exists");
      duplicate(
        config.statements.map((s) => s.id),
        node.id,
        (id) => ({ statementId: id }),
      );
      for (const edge of graph.edges.filter((e) => e.sourceId === node.id))
        if (!config.statements.some((s) => s.id === edge.sourceHandle))
          add("switch-handle-unknown", node.id, "Edge names no switch statement");
    } else {
      if (config.executionMode === "loop" && !config.inputField)
        add("loop-needs-input-field", node.id, "Loop mode needs inputField");
      if (
        config.passThrough &&
        !config.outputPath &&
        (config.executionMode === "loop" ||
          (kind === "jsonataDecisionTable" && config.hitPolicy === "collect"))
      )
        add("pass-through-needs-object", node.id, "Pass-through needs an object output");
    }
  }
  for (const node of graph.nodes) {
    if (node.type !== "customNode" || node.content.kind !== "jsonataDecisionTable") continue;
    const config = node.content.config;
    duplicate(
      [...config.inputs, ...config.outputs].map((c) => c.id),
      node.id,
      (id) => ({ columnId: id }),
    );
    duplicate(
      config.rules.map((r) => r._id),
      node.id,
      (id) => ({ ruleId: id }),
    );
    for (let i = 0; i < config.outputs.length; i++)
      for (const other of config.outputs.slice(i + 1)) {
        const c = config.outputs[i]!;
        if (
          c.field === other.field ||
          c.field.startsWith(`${other.field}.`) ||
          other.field.startsWith(`${c.field}.`)
        )
          add("output-field-conflict", node.id, "Output fields overlap", { columnId: other.id });
      }
  }
  for (const site of collectDecisionModelExpressions(graph, key)) {
    const { boolean, ...location } = site;
    try {
      const compiled = compileExpression(site.expression, site.location);
      if (boolean && neverBoolean(compiled.expression.ast()))
        findings.push({
          ...location,
          severity: "warning",
          kind: "never-boolean",
          message: "Expression cannot return a boolean",
        });
    } catch (error) {
      const detail = (error as ExpressionError).detail;
      findings.push({ ...location, ...detail, model: key, severity: "error", kind: "syntax" });
    }
  }
  return findings;
}
