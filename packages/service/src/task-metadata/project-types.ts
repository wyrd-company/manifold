// ---
// relationships:
//   implements: projects-api
// ---
import type { ProjectMetadata, TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { GitHubSource, ProjectField, ProjectFieldOption } from "../github-source/index.ts";
import type { Revisions } from "../service/index.ts";
export type ConfigurationState =
  | { readonly state: "not-applied" | "in-sync" }
  | { readonly state: "drift" | "pending"; readonly count: number };
export type FieldTarget = {
  readonly name: string;
  readonly type: ProjectField["type"];
  readonly options?: readonly Omit<ProjectFieldOption, "id">[];
};
export interface PlanChange {
  readonly id: string;
  readonly storage: "project-field";
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
  readonly properties: readonly ("name" | "options" | "order" | "color" | "description")[];
  readonly from: FieldTarget | Omit<ProjectFieldOption, "id"> | null;
  readonly to: FieldTarget | Omit<ProjectFieldOption, "id"> | null;
}
export interface FieldStatus {
  readonly field: string;
  readonly lifecycle: boolean;
  readonly taskField?: string;
  readonly github: "present" | "missing" | "differs";
  readonly detail: string;
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
}
export interface ProjectPlan {
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
  readonly frontMatter: null;
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
>;
export interface ProjectConfigurationOptions {
  readonly bindings: () => readonly BoundProject[];
  readonly revisions: Pick<Revisions, "save">;
}
