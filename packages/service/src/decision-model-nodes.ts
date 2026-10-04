// ---
// relationships:
//   implements: decision-models
// ---
import {
  evaluateExpression,
  ExpressionError,
  assertExpressionData,
  decisionModelBlank,
  decisionModelLocation,
} from "@wyrd-company/manifold-shared";
import type {
  CompiledExpression,
  DecisionCustomContent,
  DecisionModelErrorDetail,
  DecisionModelLocation,
} from "@wyrd-company/manifold-shared";
import {
  authoredDecisionValue,
  authoredDecisionNodes,
  decisionObject,
  readDecisionPath,
  writeDecisionPath,
  mergeDecisionObjects,
} from "./decision-model-values.ts";
export function createDecisionNodeHandler(compiled: ReadonlyMap<string, CompiledExpression>) {
  return async (
    model: string,
    nodeId: string,
    content: DecisionCustomContent,
    rawInput: unknown,
  ) => {
    const { $nodes, ...input } = decisionObject(rawInput) ? rawInput : {};
    const whole = authoredDecisionValue(decisionObject(rawInput) ? input : rawInput);
    const nodes = authoredDecisionNodes($nodes);
    const fail = (message: string, extra: Partial<DecisionModelLocation> = {}) => {
      throw new Error(
        JSON.stringify({
          kind: "result",
          model,
          nodeId,
          message,
          ...extra,
        } satisfies DecisionModelErrorDetail),
      );
    };
    const evaluate = async (
      source: string,
      segments: string[],
      context: unknown,
      nodeInput: unknown,
      extra: Partial<DecisionModelLocation> = {},
      data = false,
    ) => {
      const location = decisionModelLocation(model, "nodes", nodeId, ...segments);
      const expression = compiled.get(location)!;
      try {
        const result = await evaluateExpression(expression, context, { input: nodeInput, nodes });
        if (data) assertExpressionData(result, { location, expression: source });
        return result;
      } catch (error) {
        const detail = (error as ExpressionError).detail;
        throw new Error(JSON.stringify({ ...detail, model, nodeId, ...extra }), { cause: error });
      }
    };
    const { kind, config } = content;
    if (kind === "jsonataSwitch") {
      if (!decisionObject(whole)) fail("Switch input must be an object");
      const taken: number[] = [];
      for (const [i, s] of config.statements.entries())
        if (
          !decisionModelBlank(s.condition) &&
          (await evaluate(s.condition!, ["statements", s.id], whole, whole, {
            statementId: s.id,
          })) === true
        ) {
          taken.push(i);
          if (config.hitPolicy === "first") break;
        }
      if (!taken.length)
        for (const [i, s] of config.statements.entries())
          if (decisionModelBlank(s.condition)) taken.push(i);
      return {
        output: {
          ...(whole as Record<string, unknown>),
          __manifoldSwitch: Object.fromEntries(
            config.statements.map((_, i) => [`s${i}`, taken.includes(i)]),
          ),
        },
        traceData: { statements: taken.map((i) => ({ id: config.statements[i]!.id })) },
      };
    }
    const nodeInput = config.inputField ? readDecisionPath(whole, config.inputField) : whole;
    const once = async (value: unknown): Promise<{ output: unknown; traceData: unknown }> => {
      if (kind === "jsonataExpression") {
        const result = await evaluate(config.expression, ["expression"], value, value, {}, true);
        return {
          output: result === undefined ? {} : result,
          traceData: { expression: config.expression },
        };
      }
      const referenceMap: Record<string, unknown> = {};
      for (const column of config.inputs)
        Object.defineProperty(referenceMap, column.id, {
          value: decisionModelBlank(column.field)
            ? value
            : await evaluate(column.field!, ["inputs", column.id, "field"], value, value, {
                columnId: column.id,
              }),
          enumerable: true,
        });
      const results: Record<string, unknown>[] = [];
      const matches: unknown[] = [];
      for (const [index, rule] of config.rules.entries()) {
        let match = true;
        for (const column of config.inputs) {
          const source = Object.hasOwn(rule, column.id) ? rule[column.id] : undefined;
          if (
            !decisionModelBlank(source) &&
            (await evaluate(
              source!,
              ["rules", rule._id, column.id],
              referenceMap[column.id],
              value,
              { ruleId: rule._id, columnId: column.id },
            )) !== true
          ) {
            match = false;
            break;
          }
        }
        if (!match) continue;
        const output: Record<string, unknown> = {};
        for (const column of config.outputs) {
          const source = Object.hasOwn(rule, column.id) ? rule[column.id] : undefined;
          if (decisionModelBlank(source)) continue;
          const result = await evaluate(
            source!,
            ["rules", rule._id, column.id],
            value,
            value,
            { ruleId: rule._id, columnId: column.id },
            true,
          );
          if (result !== undefined) writeDecisionPath(output, column.field, result);
        }
        results.push(output);
        matches.push({ index, rule: { _id: rule._id }, reference_map: referenceMap });
        if (config.hitPolicy === "first") break;
      }
      return {
        output: config.hitPolicy === "first" ? (results[0] ?? {}) : results,
        traceData: config.hitPolicy === "first" ? (matches[0] ?? null) : matches,
      };
    };
    let output: unknown, traceData: unknown;
    if (config.executionMode === "loop") {
      if (!Array.isArray(nodeInput)) fail("Loop input must be an array");
      const results = [];
      for (const value of nodeInput as unknown[]) results.push(await once(value));
      output = results.map((r) => r.output);
      traceData = results.map((r) => r.traceData);
    } else ({ output, traceData } = await once(nodeInput));
    if (config.outputPath) {
      const wrapped = {};
      writeDecisionPath(wrapped, config.outputPath, output);
      output = wrapped;
    }
    if (config.passThrough) {
      if (!decisionObject(output)) fail("Pass-through output must be an object");
      output = mergeDecisionObjects(
        decisionObject(whole) ? whole : {},
        output as Record<string, unknown>,
      );
    }
    return { output, traceData };
  };
}
