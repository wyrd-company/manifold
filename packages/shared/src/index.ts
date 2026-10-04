// ---
// relationships:
//   implements: [blueprint-expressions, decision-models, expressions-configuration, blueprint-loader, portfolio-ledger, portfolio-declaration, bindings-declaration]
// ---
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
export type {
  Comparator,
  ComparatorInput,
  ComparatorTask,
  ComparatorHolder,
  ComparatorSelection,
  ComparatorReservation,
} from "./comparator.d.ts";
export { lintDecisionModel, collectDecisionModelExpressions } from "./decision-models.ts";
export { decisionModelBlank, decisionModelLocation } from "./decision-model-types.ts";
export type * from "./decision-model-types.ts";
export { memoryRevision } from "./process-repository-revision.ts";
export type { ProcessRepositoryRevision } from "./process-repository-revision.ts";
export {
  serviceConfigurationSchema,
  processRepositoryConfigurationSchema,
  comparatorSandboxConfigurationSchema,
  serviceConfigurationSchemas,
  serviceConfigurationSchemaId,
} from "./service-configuration-schemas.ts";

export { expressionsConfigurationSchema } from "./expressions-configuration-schema.ts";
export { lintBlueprint } from "./blueprint-lint.ts";
export type { BlueprintDocument, BlueprintFinding, BlueprintLint } from "./blueprint-lint.ts";
export { blueprintVersionKey, parseBlueprintVersionKey } from "./blueprint-version.ts";
export type { BlueprintVersion } from "./blueprint-version.ts";
export { manifoldImplementationNames } from "./implementation-names.ts";
export type { ImplementationNames } from "./implementation-names.ts";
export {
  parseLedgerPortfolio,
  LedgerError,
  portfolioData,
  allocationFor,
  itemPath,
} from "./ledger-portfolio.ts";
export type {
  LedgerPortfolio,
  LedgerPortfolioInput,
  LedgerErrorCode,
  PortfolioItem,
} from "./ledger-portfolio.ts";

export { lintPortfolioDeclaration } from "./portfolio-declaration.ts";
export {
  portfolioDeclarationSchema,
  bindingsDeclarationSchema,
} from "./portfolio-declaration-schema.ts";
export type {
  PortfolioDeclaration,
  PortfolioFinding,
  PortfolioFindingKind,
  PortfolioLintResult,
} from "./portfolio-declaration-types.ts";
export { githubEventsSchema } from "./github-events-schema.ts";
export { githubSourceConfigurationSchema } from "./github-source-configuration-schema.ts";
export type { ManifoldIdentity } from "./manifold-identity.ts";
export { blueprintSchema } from "./blueprint-schema.ts";
