// ---
// relationships:
//   implements: operator-console
// ---
import type { DecisionGraphType } from "@gorules/jdm-editor";
import type { ModelFinding } from "@wyrd-company/manifold-shared/declarations-api";
export function modelProblem(finding: ModelFinding, model?: DecisionGraphType) {
  const detail = finding["finding"];
  if (!detail || typeof detail !== "object") return { description: finding.message };
  const nodeId = Reflect.get(detail, "nodeId"),
    columnId = Reflect.get(detail, "columnId"),
    ruleId = Reflect.get(detail, "ruleId"),
    statementId = Reflect.get(detail, "statementId");
  const node = model?.nodes.find((n) => n.id === nodeId);
  const content = node?.content as
    | {
        kind?: string;
        config?: {
          inputs?: { id: string; name?: string }[];
          outputs?: { id: string; name?: string }[];
          rules?: { _id: string }[];
          statements?: { id: string; condition?: string | null }[];
        };
      }
    | undefined;
  const config = content?.config;
  const column = [...(config?.inputs ?? []), ...(config?.outputs ?? [])].find(
    (c) => c.id === columnId,
  );
  const rule = config?.rules?.findIndex((r) => r._id === ruleId) ?? -1;
  const statement = config?.statements?.findIndex((s) => s.id === statementId) ?? -1;
  const location = Reflect.get(detail, "location");
  const setting =
    typeof location === "string"
      ? ["inputField", "outputPath"].find((key) => location.endsWith("/" + key))
      : undefined;
  const label =
    column && rule >= 0
      ? `${column.name} JSONata rule ${rule + 1}`
      : statement >= 0
        ? config?.statements?.[statement]?.condition
          ? `Condition ${statement + 1}`
          : "Default"
        : setting === "inputField"
          ? "Input field"
          : setting === "outputPath"
            ? "Output path"
            : content?.kind === "jsonataExpression"
              ? "JSONata expression"
              : undefined;
  return {
    ...(typeof nodeId === "string" ? { nodeId } : {}),
    ...(label ? { label } : {}),
    ...(column ? { column: column.name ?? column.id } : {}),
    description: [
      node?.name ?? nodeId,
      rule >= 0 ? `rule ${rule + 1}` : undefined,
      column?.name ?? columnId,
      statement >= 0 ? `statement ${statement + 1}` : undefined,
      finding.message,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
