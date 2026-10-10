// ---
// relationships:
//   implements: [blueprint-expressions, decision-models, expressions-configuration]
// ---
export const packageName = "@wyrd-company/manifold-service";

export {
  configureBlueprintExpressions,
  expressionsDefaults,
  createBlueprintExpressions,
} from "./blueprint-expressions.ts";
export { createDecisionModels, DecisionModelLoadError } from "./decision-models.ts";
export type { DecisionModels } from "./decision-models.ts";

export type { ExpressionsConfiguration } from "./blueprint-expressions.ts";
