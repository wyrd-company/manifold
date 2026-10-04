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
}
export interface ProcessRepository {
  current(): ProcessRepositoryRevision | undefined;
  revisionAt(commit: string): Promise<ProcessRepositoryRevision | undefined>;
  pull(request?: PullRequest): Promise<PullOutcome>;
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
