// ---
// relationships:
//   implements: projects-api
// ---
import type {
  ProjectMetadata,
  TaskMetadataDeclaration,
  StorageScope,
  ScopeOwnership,
  TaskFieldStorage,
} from "@wyrd-company/manifold-shared";
import type {
  GitHubSource,
  ProjectField,
  ProjectFieldOption,
  ScopeConfiguration,
  ScopeEntityWrite,
} from "../github-source/index.ts";
import type { Revisions } from "../service/index.ts";
export type ConfigurationState =
  | { readonly state: "not-applied" | "in-sync" }
  | { readonly state: "drift" | "pending"; readonly count: number };
export type FieldTarget = {
  readonly name: string;
  readonly type: ProjectField["type"];
  readonly options?: readonly Omit<ProjectFieldOption, "id">[];
};
export interface EntityTarget {
  readonly entity: "issue-type" | "label" | "milestone";
  readonly name: string;
  readonly color?: string | undefined;
  readonly description: string;
  readonly enabled?: boolean;
}
export interface PlanChange {
  readonly id: string;
  readonly storage: Exclude<TaskFieldStorage["kind"], "front-matter">;
  readonly scope?: ScopeReference;
  readonly target: {
    readonly field: string;
    readonly option?: string;
    readonly lifecycle: boolean;
    readonly taskField?: string;
  };
  readonly description: string;
  readonly action: "create" | "change" | "remove";
  readonly side: "github" | "declaration";
  readonly drift: boolean;
  readonly requiresRemoval: boolean;
  readonly properties: readonly (
    | "name"
    | "options"
    | "order"
    | "color"
    | "description"
    | "enabled"
  )[];
  readonly from: FieldTarget | Omit<ProjectFieldOption, "id"> | EntityTarget | null;
  readonly to: FieldTarget | Omit<ProjectFieldOption, "id"> | EntityTarget | null;
}
export interface FieldStatus {
  readonly field: string;
  readonly lifecycle: boolean;
  readonly taskField?: string;
  readonly storage?: Exclude<TaskFieldStorage["kind"], "project-field">;
  readonly github: "present" | "missing" | "differs";
  readonly detail: string;
}
export interface ScopeReference {
  readonly kind: StorageScope["kind"];
  readonly name: string;
  readonly bindings: readonly string[];
}
export interface ScopeStatus {
  readonly scope: ScopeReference;
  readonly status: ScopeConfiguration["status"] | "unobserved";
  readonly observedAt: number | null;
  readonly message?: string;
}
export interface AppliedScope {
  readonly configuration: ScopeConfiguration;
  readonly owned: Readonly<Record<string, string>>;
}
export interface ScopeInput {
  readonly scope: StorageScope;
  readonly owned: ScopeOwnership;
  readonly bindings: readonly string[];
  readonly observed: ScopeConfiguration | undefined;
  readonly applied: AppliedScope | undefined;
}
export interface OutsideRepository {
  readonly repository: string;
  readonly issues: number;
}
export interface ScopePlan {
  readonly changes: readonly PlanChange[];
  readonly writes: readonly { write: ScopeEntityWrite; changes: readonly PlanChange[] }[];
  readonly applied: AppliedScope | undefined;
}
export interface AppliedConfiguration {
  readonly fields: readonly ProjectField[];
  readonly owned: {
    readonly lifecycle: string | undefined;
    readonly fields: Readonly<Record<string, string>>;
  };
}
export interface PlanInput {
  readonly metadata: ProjectMetadata | undefined;
  readonly fields: readonly ProjectField[];
  readonly applied: AppliedConfiguration | undefined;
  readonly scopes?: readonly ScopeInput[];
  readonly outside?: readonly OutsideRepository[];
}
export interface ProjectPlan {
  readonly scopes: readonly ScopeStatus[];
  readonly outside: readonly OutsideRepository[];
  readonly changes: readonly PlanChange[];
  readonly configuration: ConfigurationState;
  readonly digest: string;
  readonly fields: readonly FieldStatus[];
}
export interface BoundProject {
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly portfolioItem: string;
  readonly environment: string;
}
export interface ProjectSummary extends BoundProject {
  readonly projectNodeId: string | null;
  readonly configuration: ConfigurationState;
  readonly lastApplied: { readonly at: number; readonly commit: string } | null;
  readonly observedAt: number | null;
}
export interface PlanAnswer extends ProjectPlan {
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly projectNodeId: string;
  readonly declarationCommit: string | null;
  readonly observedAt: number | null;
  readonly observation:
    | { readonly status: "fresh" }
    | { readonly status: "stale"; readonly message: string };
  readonly frontMatter: { readonly mismatched: number } | null;
}
export interface ApplyRequest {
  readonly removeUndeclared: boolean;
  readonly digest?: string;
}
export type AppliedChange = PlanChange & {
  readonly outcome: "applied" | "kept" | "failed" | "not-run";
};
export type ApplyAnswer = {
  readonly outcome: "applied" | "in-sync";
  readonly changes: readonly AppliedChange[];
  readonly writes: number;
  readonly configuration: ConfigurationState;
  readonly declarationCommit: string | null;
};
export interface DeclarationImpact {
  readonly scopes: readonly ScopeStatus[];
  readonly outside: readonly OutsideRepository[];
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly configuration: ConfigurationState;
  readonly changes: readonly PlanChange[];
  readonly fields: readonly FieldStatus[];
}
export interface ProjectConfiguration {
  list(): readonly ProjectSummary[];
  plan(binding: string, signal?: AbortSignal): Promise<PlanAnswer>;
  apply(binding: string, request: ApplyRequest, signal?: AbortSignal): Promise<ApplyAnswer>;
  planDeclaration(declaration: TaskMetadataDeclaration): readonly DeclarationImpact[];
}
export type ConfigurationSource = Pick<
  GitHubSource,
  | "project"
  | "projectByNumber"
  | "moveCard"
  | "projectFields"
  | "observeProjectFields"
  | "writeProjectField"
> &
  Partial<
    Pick<
      GitHubSource,
      "scopeConfiguration" | "observeScope" | "writeScopeEntity" | "trackedIssueIndex"
    >
  >;
export interface ProjectConfigurationOptions {
  readonly bindings: () => readonly BoundProject[];
  readonly revisions: Pick<Revisions, "save">;
}
