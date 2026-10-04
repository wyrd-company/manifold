// ---
// relationships:
//   implements: decision-models
// ---
import type {
  DecisionModel,
  DecisionModelTrace,
  DecisionModelErrorDetail,
} from "@wyrd-company/manifold-shared";
import { decisionObject } from "./decision-model-values.ts";

function restoreNullProperties(value: unknown, sources: readonly unknown[]): unknown {
  if (!decisionObject(value)) return value;
  const restored = { ...value };
  for (const source of sources)
    if (decisionObject(source))
      for (const [key, child] of Object.entries(source))
        if (child === null && !Object.hasOwn(restored, key))
          Object.defineProperty(restored, key, {
            value: null,
            enumerable: true,
            writable: true,
            configurable: true,
          });
  return restored;
}
export function restoreDecisionModelResult(
  result: unknown,
  trace: DecisionModelTrace,
  model: DecisionModel,
): unknown {
  return restoreNullProperties(
    result,
    model.nodes.filter((node) => node.type === "outputNode").map((node) => trace[node.id]?.input),
  );
}
// Child output-node inputs retain the nulls Zen removes from subgraph results.
export function repairDecisionModelTrace(
  trace: DecisionModelTrace,
  key: string,
  models: Readonly<Record<string, DecisionModel>>,
): DecisionModelTrace {
  const model = models[key]!;
  const restored = Object.fromEntries(
    Object.entries(trace).map(([id, entry]) => {
      const node = model.nodes.find((node) => node.id === id);
      if (node?.type !== "decisionNode" || !decisionObject(entry.traceData))
        return [id, { ...entry }];
      const childTrace = repairDecisionModelTrace(
        entry.traceData as DecisionModelTrace,
        node.content.key,
        models,
      );
      return [
        id,
        {
          ...entry,
          traceData: childTrace,
          output: restoreDecisionModelResult(entry.output, childTrace, models[node.content.key]!),
        },
      ];
    }),
  );
  for (const node of model.nodes)
    if (node.type === "outputNode" && restored[node.id]) {
      const entry = restored[node.id]!;
      entry.input = restoreNullProperties(
        entry.input,
        model.edges
          .filter((edge) => edge.targetId === node.id)
          .map((edge) => restored[edge.sourceId]?.output),
      );
    }
  return restored;
}
export function enrichDecisionModelError(
  trace: DecisionModelTrace,
  key: string,
  models: Readonly<Record<string, DecisionModel>>,
  error: DecisionModelErrorDetail,
): boolean {
  if (key === error.model && error.nodeId && trace[error.nodeId]?.traceData === null) {
    trace[error.nodeId]!.traceData = { error };
    return true;
  }
  for (const node of models[key]!.nodes)
    if (
      node.type === "decisionNode" &&
      decisionObject(trace[node.id]?.traceData) &&
      enrichDecisionModelError(
        trace[node.id]!.traceData as DecisionModelTrace,
        node.content.key,
        models,
        error,
      )
    )
      return true;
  return false;
}
