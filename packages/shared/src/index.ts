export const packageName = "@wyrd-company/manifold-shared";

export { compileExpression, evaluateExpression, ExpressionError } from "./expressions.ts";
export type { CompiledExpression, ExpressionErrorDetail } from "./expressions.ts";
export { collectExpressionSites, lintBlueprintExpressions } from "./blueprint-expressions.ts";
export type {
  ExpressionBlueprint,
  ExpressionSite,
  ExpressionFinding,
  Schema,
} from "./blueprint-expressions.ts";
export { compileExpressionResult, assertExpressionData } from "./expression-results.ts";
