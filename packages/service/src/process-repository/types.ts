// ---
// relationships:
//   implements: process-repository
// ---
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type {
  Credentials,
  ProcessRepositoryConfiguration,
} from "../service-configuration/index.ts";
export interface ProcessRepositoryOptions {
  readonly configuration: ProcessRepositoryConfiguration;
  readonly credentials: Credentials;
  readonly probe?: PullProbe;
  readonly saveProbe?: SaveProbe;
}
export interface ProcessRepository {
  isAncestor(ancestor: string, commit: string): Promise<boolean>;
  current(): ProcessRepositoryRevision | undefined;
  revisionAt(commit: string): Promise<ProcessRepositoryRevision | undefined>;
  pull(request?: PullRequest): Promise<PullOutcome>;
  save(request: SaveRequest): Promise<SaveOutcome>;
  findSave(request: Pick<SaveRequest, "base" | "saveId">): Promise<string | undefined>;
}
export interface PullRequest {
  readonly commit?: string;
}
export type PullOutcome =
  | { readonly kind: "unchanged"; readonly commit: string }
  | { readonly kind: "advanced"; readonly commit: string; readonly previous: string | undefined };
export type PullStep = "fetched" | "verified" | "published";
export type PullProbe = (step: PullStep, commit: string) => void;
export class ProcessRepositoryPullError extends Error {
  readonly kind: "authentication" | "remote" | "branch-missing" | "incomplete";
  constructor(kind: ProcessRepositoryPullError["kind"], message: string) {
    super(message);
    this.name = "ProcessRepositoryPullError";
    this.kind = kind;
  }
}
export class ProcessRepositoryOpenError extends Error {
  readonly commit: string;
  readonly directory: string;
  constructor(commit: string, directory: string) {
    super(`Unreadable process repository commit ${commit} in ${directory}`);
    this.name = "ProcessRepositoryOpenError";
    this.commit = commit;
    this.directory = directory;
  }
}

export interface SaveFile {
  readonly path: string;
  readonly text: string;
}
export interface SaveConflictFile {
  readonly path: string;
  readonly text: string | undefined;
}
export interface SaveRequest {
  readonly files: readonly SaveFile[];
  readonly base: string;
  readonly message: string;
  readonly saveId: string;
}
export type SaveOutcome =
  | { readonly kind: "pushed"; readonly commit: string; readonly parent: string }
  | { readonly kind: "already-saved"; readonly commit: string }
  | { readonly kind: "unchanged"; readonly commit: string }
  | {
      readonly kind: "conflict";
      readonly head: string;
      readonly files: readonly SaveConflictFile[];
    };
export type SaveStep = "committed" | "pushed";
export type SaveProbe = (step: SaveStep, commit: string) => void;
export class ProcessRepositorySaveError extends Error {
  readonly kind: "authentication" | "rejected" | "remote";
  readonly head: string;
  constructor(kind: ProcessRepositorySaveError["kind"], head: string, message: string) {
    super(message);
    this.name = "ProcessRepositorySaveError";
    this.kind = kind;
    this.head = head;
  }
}
