// ---
// relationships:
//   implements: task-metadata
// ---
import type { fromPromise } from "xstate";
import type {
  ProcessRepositoryRevision,
  TaskMetadataDeclaration,
  TaskMetadataFinding,
} from "@wyrd-company/manifold-shared";
import type { ActorHost, Invocation } from "../actor-host/index.ts";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import type { GitHubProject, GitHubSource } from "../github-source/index.ts";
import type {
  ProjectConfiguration,
  ProjectConfigurationOptions,
  ConfigurationSource,
} from "./project-types.ts";
import type { HttpListener } from "../http-host/index.ts";
import type { StoreConnection } from "../store/index.ts";
export interface TaskMetadataOptions {
  readonly actorOf: ActorHost["actorOf"];
  readonly invocationOf: (args: Parameters<Parameters<typeof fromPromise>[0]>[0]) => Invocation;
  readonly source: (
    signal: AbortSignal,
  ) => Promise<Pick<GitHubSource, "project" | "moveCard"> & Partial<ConfigurationSource>>;
  readonly bindings?: ProjectConfigurationOptions["bindings"];
  readonly revisions?: ProjectConfigurationOptions["revisions"];
  readonly now?: () => number;
  readonly revisionAt?: (commit: string) => Promise<ProcessRepositoryRevision | undefined>;
  readonly bindingOf: (project: GitHubProject) => string | undefined;
  readonly connection: StoreConnection;
}
export type TaskMetadataApplied =
  | { readonly status: "applied"; readonly commit: string }
  | {
      readonly status: "rejected";
      readonly commit: string;
      readonly findings: readonly TaskMetadataFinding[];
    };
export interface TaskMetadata {
  readonly implementations: ImplementationRegistry;
  apply(revision: ProcessRepositoryRevision): Promise<TaskMetadataApplied>;
  current(): TaskMetadataDeclaration | undefined;
  readonly projects: ProjectConfiguration;
  readonly requestListener: HttpListener;
  close(): Promise<void>;
}
export type CardMoveErrorKind =
  | "input"
  | "identity"
  | "undeclared"
  | "field-missing"
  | "option-missing"
  | "item-missing"
  | "forbidden"
  | "transport"
  | "rejected";
export type CardMoveError = {
  readonly type: "card-move";
  readonly kind: CardMoveErrorKind;
  readonly message: string;
  readonly status?: string;
};
