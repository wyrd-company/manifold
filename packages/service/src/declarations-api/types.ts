// ---
// relationships:
//   implements: declarations-api
// ---
import type { TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { Revisions } from "../service/index.ts";
import type { ProcessRepository } from "../process-repository/index.ts";
export interface DeclarationsT3codeProject {
  readonly id: string;
  readonly title: string;
  readonly workspaceRoot: string;
  readonly activeThreads: number;
}
export interface DeclarationImpact {
  readonly binding: string;
  readonly changes: readonly { readonly action: "create" | "change" | "remove" }[];
  readonly fields: readonly {
    readonly taskField?: string;
    readonly lifecycle: boolean;
    readonly github: "present" | "missing" | "differs";
    readonly detail: string;
  }[];
}
export interface DeclarationsApiOptions {
  readonly revisions: Pick<Revisions, "latest" | "save" | "findSave">;
  readonly processRepository: Pick<ProcessRepository, "revisionAt">;
  readonly repository: { readonly url: string; readonly branch: string };
  readonly environments: readonly string[];
  createdProjects(): readonly import("../portfolio/types.ts").CreatedProjectOwnership[];
  t3codeProjects(environment: string): readonly DeclarationsT3codeProject[] | undefined;
  planDeclaration(declaration: TaskMetadataDeclaration): readonly DeclarationImpact[];
  readonly log: (entry: { level: "error"; path: string; error: string }) => void;
}
