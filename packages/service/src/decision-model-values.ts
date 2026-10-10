// ---
// relationships:
//   implements: decision-models
// ---
import type { DecisionModelTrace, DecisionModel } from "@wyrd-company/manifold-shared";
export const decisionObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
export function readDecisionPath(value: unknown, path: string): unknown {
  let result = value;
  for (const key of path.split(".")) {
    if (!decisionObject(result) || !Object.hasOwn(result, key)) return null;
    result = result[key];
  }
  return result;
}
export function writeDecisionPath(target: Record<string, unknown>, path: string, value: unknown) {
  const keys = path.split(".");
  let parent = target;
  for (const key of keys.slice(0, -1)) {
    if (!Object.hasOwn(parent, key) || !decisionObject(parent[key]))
      Object.defineProperty(parent, key, {
        value: {},
        enumerable: true,
        configurable: true,
        writable: true,
      });
    parent = parent[key] as Record<string, unknown>;
  }
  Object.defineProperty(parent, keys.at(-1)!, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
}
export function mergeDecisionObjects(
  base: Record<string, unknown>,
  output: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(output))
    Object.defineProperty(result, key, {
      value:
        decisionObject(value) && Object.hasOwn(base, key) && decisionObject(base[key])
          ? mergeDecisionObjects(base[key], value)
          : value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  return result;
}
// Project the containers the engine exposes, without rewriting user properties inside values.
export function authoredDecisionValue(value: unknown, generatedIds: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((child) => authoredDecisionValue(child, generatedIds));
  if (!decisionObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "__manifoldSwitch")
      .map(([key, child]) => [
        key,
        key === "$nodes" ? authoredDecisionNodes(child, generatedIds) : child,
      ]),
  );
}
export function authoredDecisionNodes(
  value: unknown,
  generatedIds: ReadonlySet<string>,
): Record<string, unknown> {
  if (!decisionObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !generatedIds.has(key))
      .map(([key, child]) => [key, authoredDecisionValue(child, generatedIds)]),
  );
}
export function authoredDecisionTrace(
  trace: DecisionModelTrace,
  model: DecisionModel,
  models: Readonly<Record<string, DecisionModel>>,
): DecisionModelTrace {
  const generatedIds = decisionRoutingIds(model);
  return Object.fromEntries(
    Object.entries(trace)
      .filter(([id]) => !generatedIds.has(id))
      .map(([id, entry]) => {
        const node = model.nodes.find((node) => node.id === id);
        return [
          id,
          {
            ...entry,
            ...(node?.type === "decisionNode" && decisionObject(entry.traceData)
              ? {
                  traceData: authoredDecisionTrace(
                    entry.traceData as DecisionModelTrace,
                    models[node.content.key]!,
                    models,
                  ),
                }
              : {}),
            ...(Object.hasOwn(entry, "input")
              ? { input: authoredDecisionValue(entry.input, generatedIds) }
              : {}),
            ...(Object.hasOwn(entry, "output")
              ? { output: authoredDecisionValue(entry.output, generatedIds) }
              : {}),
          },
        ];
      }),
  );
}

export function decisionRoutingIds(model: DecisionModel): ReadonlySet<string> {
  return new Set(
    model.nodes
      .filter((node) => node.type === "customNode" && node.content.kind === "jsonataSwitch")
      .map((node) => `${node.id}~route`),
  );
}
