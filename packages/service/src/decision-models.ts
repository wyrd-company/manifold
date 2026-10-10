// ---
// relationships:
//   implements: decision-models
//   references: zen-jsonata
// ---
import { ZenEngine } from "@gorules/zen-engine";
import {
  lintDecisionModel,
  collectDecisionModelExpressions,
  compileExpression,
  decisionModelLocation,
} from "@wyrd-company/manifold-shared";
import type {
  DecisionModel,
  DecisionCustomContent,
  DecisionModelFinding,
  DecisionModelEvaluation,
  DecisionModelTrace,
  DecisionModelErrorDetail,
} from "@wyrd-company/manifold-shared";
import { createDecisionNodeHandler } from "./decision-model-nodes.ts";
import {
  authoredDecisionValue,
  authoredDecisionTrace,
  decisionRoutingIds,
} from "./decision-model-values.ts";
import {
  repairDecisionModelTrace,
  restoreDecisionModelResult,
  enrichDecisionModelError,
} from "./decision-model-trace.ts";
export class DecisionModelLoadError extends Error {
  readonly findings: readonly DecisionModelFinding[];
  constructor(findings: readonly DecisionModelFinding[]) {
    super("Decision models failed to load");
    this.name = "DecisionModelLoadError";
    this.findings = findings;
  }
}
export interface DecisionModels {
  readonly findings: readonly DecisionModelFinding[];
  evaluate(key: string, input: Record<string, unknown>): Promise<DecisionModelEvaluation>;
  dispose(): void;
}
function prepareDecisionModel(model: DecisionModel, key: string) {
  const prepared = structuredClone(model) as {
    nodes: Record<string, unknown>[];
    edges: DecisionModel["edges"];
  };
  for (const copy of prepared.nodes) copy["name"] ??= copy["id"];
  for (const node of model.nodes) {
    if (node.type !== "customNode") continue;
    const copy = prepared.nodes.find((n) => n["id"] === node.id)!;
    copy["content"] = {
      ...node.content,
      config: { ...structuredClone(node.content.config), $model: key },
    };
    if (node.content.kind !== "jsonataSwitch") continue;
    const statements = node.content.config.statements;
    prepared.nodes.push({
      id: `${node.id}~route`,
      name: `${node.id}~route`,
      type: "switchNode",
      content: {
        hitPolicy: "collect",
        statements: statements.map((_, i) => ({
          id: `s${i}`,
          condition: `__manifoldSwitch.s${i}`,
        })),
      },
    });
    for (const edge of prepared.edges)
      if (edge.sourceId === node.id) {
        edge.sourceId = `${node.id}~route`;
        edge.sourceHandle = `s${statements.findIndex((s) => s.id === edge.sourceHandle)}`;
      }
    prepared.edges.push({
      id: `${node.id}~route`,
      sourceId: node.id,
      targetId: `${node.id}~route`,
    });
  }
  return prepared;
}
export function createDecisionModels(models: Readonly<Record<string, unknown>>): DecisionModels {
  const keys = Object.keys(models).sort();
  const findings = keys.flatMap((key) => lintDecisionModel(models[key], key));
  for (const key of keys) {
    if (findings.some((f) => f.model === key && f.kind === "structure")) continue;
    for (const node of (models[key] as DecisionModel).nodes)
      if (node.type === "decisionNode" && !Object.hasOwn(models, node.content.key))
        findings.push({
          severity: "error",
          kind: "model-missing",
          model: key,
          nodeId: node.id,
          location: decisionModelLocation(key, "nodes", node.id),
          message: `Missing model: ${node.content.key}`,
        });
  }
  const errors = findings.filter((f) => f.severity === "error");
  if (errors.length) throw new DecisionModelLoadError(errors);
  const snapshots = structuredClone(models) as Record<string, DecisionModel>;
  const compiled = new Map(
    keys.flatMap((key) =>
      collectDecisionModelExpressions(snapshots[key]!, key).map(
        (site) => [site.location, compileExpression(site.expression, site.location)] as const,
      ),
    ),
  );
  const handler = createDecisionNodeHandler(compiled, snapshots);
  const engine = new ZenEngine({
    loader: {
      type: "static",
      content: Object.fromEntries(
        keys.map((key) => [key, prepareDecisionModel(snapshots[key]!, key)]),
      ),
    },
    customHandler: async (request) => {
      const config = request.node.config as Record<string, unknown>;
      return handler(
        config["$model"] as string,
        request.node.id,
        { kind: request.node.kind, config } as DecisionCustomContent,
        request.input as unknown,
      );
    },
  });
  return {
    findings: findings.filter((f) => f.severity === "warning"),
    dispose: () => engine.dispose(),
    async evaluate(key, input) {
      if (!Object.hasOwn(snapshots, key)) throw new Error(`Unknown decision model: ${key}`);
      const record = {
        model: key,
        input: authoredDecisionValue(input, decisionRoutingIds(snapshots[key]!)) as Record<
          string,
          unknown
        >,
      };
      try {
        const result = await engine.evaluate(key, input, { trace: true });
        const trace = repairDecisionModelTrace(
          (result.trace ?? {}) as DecisionModelTrace,
          key,
          snapshots,
        );
        const output = restoreDecisionModelResult(result.result as unknown, trace, snapshots[key]!);
        return {
          ...record,
          outcome: "result",
          result: authoredDecisionValue(output, decisionRoutingIds(snapshots[key]!)),
          trace: authoredDecisionTrace(trace, snapshots[key]!, snapshots),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        let trace: DecisionModelTrace = {};
        let detail: DecisionModelErrorDetail = { kind: "engine", model: key, message };
        try {
          const envelope = JSON.parse(message) as {
            type?: string;
            nodeId?: string;
            source?: string;
            trace?: DecisionModelTrace;
          };
          trace = envelope.trace ?? {};
          if (envelope.type === "NodeError" && envelope.source) {
            const parsed = JSON.parse(
              envelope.source.replace(/^Error: /, ""),
            ) as DecisionModelErrorDetail;
            if (parsed.kind === "evaluation" || parsed.kind === "result") {
              detail = parsed;
              enrichDecisionModelError(trace, key, snapshots, detail);
            }
          }
        } catch {
          /* Engine failures need not be JSON envelopes. */
        }
        return {
          ...record,
          outcome: "error",
          error: detail,
          trace: authoredDecisionTrace(
            repairDecisionModelTrace(trace, key, snapshots),
            snapshots[key]!,
            snapshots,
          ),
        };
      }
    },
  };
}
