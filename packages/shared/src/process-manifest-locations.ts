// ---
// relationships:
//   implements: process-manifest
// ---
import type { DecisionModel, DecisionModelFinding } from "./decision-model-types.ts";
const escape = (part: string) => part.replaceAll("~", "~0").replaceAll("/", "~1");
export function manifestFindingLocation(model: DecisionModel, f: DecisionModelFinding): string {
  if (f.kind === "structure") return f.instancePath ?? "";
  if (f.nodeId === undefined) return "";
  const nodes = model.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.id === f.nodeId);
  if (nodes.length > 1 && f.kind !== "duplicate-id") return "/nodes";
  const selected = nodes.at(-1);
  if (!selected) return "";
  const { node, index } = selected;
  const root = `/nodes/${index}`;
  if (node.type !== "customNode") return root;
  const base = root + "/content/config";
  const config = node.content.config;
  if (f.statementId !== undefined && "statements" in config) {
    const ids = config.statements.flatMap((s, i) => (s.id === f.statementId ? [i] : []));
    if (ids.length > 1 && f.kind !== "duplicate-id") return base + "/statements";
    return ids.length
      ? `${base}/statements/${ids.at(-1)}${f.kind === "syntax" || f.kind === "never-boolean" ? "/condition" : ""}`
      : base;
  }
  if (f.ruleId !== undefined && "rules" in config) {
    const ids = config.rules.flatMap((r, i) => (r._id === f.ruleId ? [i] : []));
    if (ids.length > 1 && f.kind !== "duplicate-id") return base + "/rules";
    if (f.columnId !== undefined) {
      const columns = [...config.inputs, ...config.outputs].filter((c) => c.id === f.columnId);
      if (columns.length > 1 && f.kind !== "duplicate-id") return base;
    }
    return ids.length
      ? `${base}/rules/${ids.at(-1)}${f.columnId === undefined ? "" : "/" + escape(f.columnId)}`
      : base;
  }
  if (f.columnId !== undefined && "inputs" in config) {
    const ids = [
      ...config.inputs.map((c, i) => ({ c, i, array: "inputs" })),
      ...config.outputs.map((c, i) => ({ c, i, array: "outputs" })),
    ].filter(({ c }) => c.id === f.columnId);
    if (ids.length > 1 && f.kind !== "duplicate-id") return base;
    const col = ids.at(-1);
    return col
      ? `${base}/${col.array}/${col.i}${f.kind === "syntax" || f.kind === "never-boolean" ? "/field" : ""}`
      : base;
  }
  if (
    (f.kind === "syntax" || f.kind === "never-boolean") &&
    node.content.kind === "jsonataExpression"
  )
    return base + "/expression";
  return root;
}
