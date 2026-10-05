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
export type {
  BlueprintDocument,
  BlueprintFinding,
  BlueprintLint,
  BlueprintLintOptions,
} from "./blueprint-lint.ts";
export {
  bundleDigest,
  blueprintVersionKey,
  parseBlueprintVersionKey,
} from "./blueprint-version.ts";
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

export { lintUsageDeclaration } from "./usage-declaration.ts";
export {
  usagePushSchema,
  usageRecordSchema,
  accountsDeclarationSchema,
  priceTableSchema,
} from "./usage-schemas.generated.ts";
export { bundledPriceTable } from "./prices.generated.ts";
export type * from "./usage-types.ts";
export { isUsagePushResult } from "./usage-push-response.ts";

export { lintTokens, defaultConfigurationBound } from "./token-lint/index.ts";
export type {
  TokenLintOptions,
  TokenLintResult,
  TokenVerdict,
  GateTokenLint,
} from "./token-lint/index.ts";
export { compileStateGuards } from "./state-guards.ts";
export { blueprintLintConfigurationSchema } from "./blueprint-lint-configuration-schema.ts";
export { escalationsConfigurationSchema } from "./escalations-configuration-schema.ts";
export { escalationContractSchema } from "./escalation-contract-schema.ts";
export { lintProcessManifest } from "./process-manifest.ts";
export type {
  ProcessManifest,
  ProcessManifestFinding,
  ProcessManifestLint,
} from "./process-manifest.ts";
export { processManifestSchema } from "./process-manifest-schema.ts";
export { intakeDecisionModelSchema } from "./intake-decision-model-schema.ts";

export {
  lintTaskMetadataDeclaration,
  declaredLifecycleOptions,
} from "./task-metadata-declaration.ts";
export type {
  TaskMetadataDeclaration,
  TaskMetadataFinding,
  TaskMetadataLint,
} from "./task-metadata-declaration.ts";
export { taskMetadataDeclarationSchema } from "./task-metadata-schema.ts";
export { agentToolsSchema } from "./agent-tools-schema.ts";
export { agentToolsConfigurationSchema } from "./agent-tools-configuration-schema.ts";
export { agentToolDefinitions, isAgentToolCallResponse } from "./agent-tools.ts";
export type { AgentToolCallResponse, ThreadMessage } from "./agent-tools.ts";

export { createSchemaCompiler } from "./schema-compiler.ts";

export { bundledFiles } from "./bundle.generated.ts";
export { blueprintGraph } from "./blueprint-graph.ts";
export { findingRanges } from "./finding-ranges.ts";
export type * from "./blueprints-api.ts";
export { lintAllocatedAccounts } from "./allocated-accounts.ts";
export type { PortfolioWarning } from "./allocated-accounts.ts";
