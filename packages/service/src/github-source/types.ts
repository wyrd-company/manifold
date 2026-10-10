// ---
// relationships:
//   implements: github-event-source
// ---
import type { StorageScope, TaskFieldStorage, TaskFieldValue } from "@wyrd-company/manifold-shared";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Credentials } from "../service-configuration/index.ts";
import type { ProcessRepository } from "../process-repository/index.ts";
import type { Store } from "../store/index.ts";
import type { Router, RouterClock } from "../router/index.ts";

export interface GitHubConfiguration {
  readonly apiUrl: string;
  readonly owners: Readonly<Record<string, GitHubOwnerConfiguration>>;
  readonly sweepIntervalMs: number;
  readonly redeliveryIntervalMs: number;
  readonly requestTimeoutMs: number;
}
export interface GitHubOwnerConfiguration {
  readonly credential: string;
  readonly hooks: readonly GitHubHookConfiguration[];
}
export interface GitHubHookConfiguration {
  readonly id: number;
  readonly repository: string | undefined;
  readonly secretFile: string;
}
export interface ProjectReference {
  readonly owner: string;
  readonly number: number;
}
export interface ProcessRepositoryTrigger extends Pick<ProcessRepository, "pull"> {
  readonly url: string;
  readonly branch: string;
}
export interface GitHubSourceOptions {
  /** Storage adapters join through their module's wiring part. */
  readonly storageAdapters?: {
    readonly observeScope: (
      scope: StorageScope,
      signal?: AbortSignal,
    ) => Promise<ScopeConfiguration>;
    readonly writeScopeEntity: (
      write: ScopeEntityWrite,
      signal?: AbortSignal,
    ) => Promise<ScopeEntity | undefined>;
    readonly writeTaskField: (
      write: TaskFieldWrite,
      issue: TrackedIssue,
      signal?: AbortSignal,
    ) => Promise<void>;
  };
  readonly taskFieldBinding?: (project: GitHubProject) => string | undefined;
  readonly taskFieldValues?: (
    projectNodeId: string,
    issue: TrackedIssue,
  ) => Readonly<Record<string, TaskFieldValueWithStorage>> | undefined;
  readonly scopes?: () => readonly StorageScope[];
  readonly probeTaskFieldWrite?: (write: TaskFieldWrite) => void;
  readonly configuration: GitHubConfiguration;
  readonly credentials: Credentials;
  readonly store: Store;
  readonly router: Router;
  readonly boundProjects: () => readonly ProjectReference[];
  readonly processRepository: ProcessRepositoryTrigger;
  readonly clock?: RouterClock;
  readonly onError?: (error: GitHubSourceError) => void;
  readonly probe?: () => void;
  readonly probeMove?: (move: CardMove) => void;
  readonly onTracked?: (issueNodeIds: readonly string[]) => void;
  /** Runs after a transaction commits changed mirror rows, including silent changes. */
  readonly onMirrorChanged?: () => void;
  /** Called after each field write returns from GitHub, before its promise resolves. */
  readonly probeFieldWrite?: (write: ProjectFieldWrite) => void;
  /** The name of the lifecycle field the declaration in force declares for a Project, by node id. */
  readonly lifecycleField?: (projectNodeId: string) => string | undefined;
}
export interface TaskFieldValueWithStorage {
  readonly storage: TaskFieldStorage["kind"];
  readonly value: TaskFieldValue;
}
export interface GitHubSource {
  scopeConfiguration(scope: StorageScope): ScopeConfiguration | undefined;
  observeScope(scope: StorageScope, signal?: AbortSignal): Promise<ScopeConfiguration>;
  writeScopeEntity(write: ScopeEntityWrite, signal?: AbortSignal): Promise<ScopeEntity | undefined>;
  writeTaskField(write: TaskFieldWrite, signal?: AbortSignal): Promise<void>;
  project(nodeId: string): GitHubProject | undefined;
  projectByNumber(owner: string, number: number): GitHubProject | undefined;
  moveCard(move: CardMove, signal?: AbortSignal): Promise<void>;
  projectFields(projectNodeId: string): ProjectFields | undefined;
  observeProjectFields(projectNodeId: string, signal?: AbortSignal): Promise<ProjectFields>;
  writeProjectField(
    write: ProjectFieldWrite,
    signal?: AbortSignal,
  ): Promise<ProjectField | undefined>;
  receive(delivery: WebhookDelivery): DeliveryOutcome;
  readonly requestListener: (request: IncomingMessage, response: ServerResponse) => void;
  requestSweep(): void;
  trackedIssue(nodeId: string): TrackedIssue | undefined;
  trackedIssueIds(): readonly string[];
  trackedIssues(): readonly TrackedIssue[];
  trackedIssueIndex(): TrackedIssueIndex;
  stop(): Promise<void>;
}
export interface ProjectFields {
  readonly projectNodeId: string;
  /** When the mirror last read them, in epoch milliseconds. */
  readonly readAt: number;
  /** In the order GitHub lists them. */
  readonly fields: readonly ProjectField[];
}
export interface ProjectField {
  readonly nodeId: string;
  readonly name: string;
  readonly type: "text" | "number" | "date" | "single-select" | "multi-select" | "iteration";
  /** A single-select field's options in order; empty for another type. */
  readonly options: readonly ProjectFieldOption[];
}
export interface ProjectFieldOption {
  readonly id: string;
  readonly name: string;
  readonly color: ProjectFieldOptionColor;
  readonly description: string;
}
export type ProjectFieldOptionColor =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "pink"
  | "purple";
/** An option to write: `id` keeps an existing option, and with it every item value that holds it. */
export interface ProjectFieldOptionWrite {
  readonly id?: string;
  readonly name: string;
  readonly color: ProjectFieldOptionColor;
  readonly description: string;
}
export type ProjectFieldWrite =
  | {
      readonly kind: "create";
      readonly projectNodeId: string;
      readonly name: string;
      readonly type: "text" | "number" | "date" | "single-select";
      /** Required for `single-select`, absent otherwise. */
      readonly options?: readonly ProjectFieldOptionWrite[];
    }
  | {
      readonly kind: "update";
      readonly projectNodeId: string;
      readonly fieldNodeId: string;
      readonly name?: string;
      /** The field's whole option list, in order. */
      readonly options?: readonly ProjectFieldOptionWrite[];
    }
  | { readonly kind: "delete"; readonly projectNodeId: string; readonly fieldNodeId: string };
export interface WebhookDelivery {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: Uint8Array;
}
export type DeliveryOutcome =
  | { readonly status: "accepted"; readonly deliveryId: string; readonly duplicate: boolean }
  | { readonly status: "rejected"; readonly error: GitHubDeliveryError };
export class GitHubDeliveryError extends Error {
  readonly kind: "malformed" | "unknown-hook" | "signature";
  readonly deliveryId: string | undefined;
  constructor(kind: GitHubDeliveryError["kind"], deliveryId: string | undefined) {
    super(`GitHub delivery rejected: ${kind}`);
    this.kind = kind;
    this.deliveryId = deliveryId;
  }
}
export class GitHubSourceError extends Error {
  readonly kind: "api" | "unconfigured-owner" | "unresolved-project" | "secret-file" | "pull";
  readonly status: number | undefined;
  constructor(kind: GitHubSourceError["kind"], message: string, status?: number, cause?: unknown) {
    super(message, { cause });
    this.kind = kind;
    this.status = status;
  }
}
export interface GitHubIssue {
  readonly title?: string;
  readonly url?: string;
  readonly nodeId: string;
  readonly repository: string;
  readonly number: number;
  readonly state: "open" | "closed";
  readonly stateReason: "completed" | "not_planned" | "duplicate" | "reopened" | null;
}
export interface GitHubProject {
  readonly nodeId: string;
  readonly owner: string;
  readonly number: number;
}
export interface TrackedIssue {
  readonly content?: IssueContent | undefined;
  readonly issue: GitHubIssue;
  readonly blockedBy: readonly GitHubIssue[];
  readonly blocking: readonly GitHubIssue[];
  readonly subIssues: readonly GitHubIssue[];
  readonly parent: GitHubIssue | undefined;
  readonly projects: readonly GitHubProject[];
  readonly items: readonly TrackedItem[];
}
export interface TrackedItem {
  readonly project: GitHubProject;
  readonly nodeId: string;
  readonly archived: boolean;
  readonly fields: Readonly<Record<string, GitHubFieldValue>>;
}
export interface ObservedIssue extends Omit<TrackedIssue, "projects" | "items"> {}
export interface ItemReference {
  readonly nodeId: string;
  readonly contentType: "issue" | "pull-request" | "draft-issue";
  readonly contentNodeId: string;
}
export type FieldValue =
  | null
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "number"; readonly number: number }
  | { readonly kind: "date"; readonly date: string }
  | { readonly kind: "single-select"; readonly optionId: string; readonly name: string }
  | {
      readonly kind: "iteration";
      readonly iterationId: string;
      readonly title: string;
      readonly startDate: string;
      readonly duration: number;
    };
export type GitHubFieldValue = FieldValue;
export interface ObservedField {
  readonly field: { readonly nodeId: string; readonly name: string };
  readonly value: FieldValue;
}
export interface ObservedItem {
  readonly item: ItemReference;
  readonly projectId: string;
  readonly issue: GitHubIssue | null;
  readonly archived: boolean;
  readonly fields: readonly ObservedField[];
}

export interface CardMove {
  readonly actorId: string;
  readonly invokeId: string;
  readonly entryId: string;
  readonly projectNodeId: string;
  readonly issueNodeId: string;
  readonly field: string;
  readonly option: string;
}
export class GitHubWriteError extends Error {
  readonly status: number | undefined;
  readonly kind:
    | "missing"
    | "out-of-scope"
    | "unavailable"
    | "front-matter-invalid"
    | "body-conflict"
    | "field-missing"
    | "option-missing"
    | "item-missing"
    | "forbidden"
    | "transport"
    | "rejected";
  constructor(
    kind:
      | "missing"
      | "out-of-scope"
      | "unavailable"
      | "front-matter-invalid"
      | "body-conflict"
      | "field-missing"
      | "option-missing"
      | "item-missing"
      | "forbidden"
      | "transport"
      | "rejected",
    message: string,
    status?: number,
  ) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/** The tracked issues of one mirror read, keyed by node id. */
export interface TrackedIssueIndex extends ReadonlyMap<string, TrackedIssue> {}
export interface IssueContent {
  /** In GitHub's order. */
  readonly labels: readonly { readonly nodeId: string; readonly name: string }[];
  readonly milestone: {
    readonly nodeId: string;
    readonly number: number;
    readonly title: string;
  } | null;
  readonly issueType: { readonly nodeId: string; readonly name: string } | null;
  /** Every issue field value the issue holds, in GitHub's order; a multi-select value is left out. */
  readonly issueFields: readonly {
    readonly fieldNodeId: string;
    readonly name: string;
    readonly value: Exclude<GitHubFieldValue, null | { readonly kind: "iteration" }>;
  }[];
  /** The body as GitHub holds it, the empty string for none. */
  readonly body: string;
  /** When GitHub last recorded an edit of the body, in epoch milliseconds, or null. */
  readonly lastEditedAt: number | null;
}

export type ScopeConfiguration =
  | {
      readonly scope: StorageScope;
      readonly status: "ready";
      readonly readAt: number;
      /** For an organization scope; empty for a repository. */
      readonly issueFields: readonly IssueFieldConfiguration[];
      readonly issueTypes: readonly IssueTypeConfiguration[];
      /** For a repository scope; empty for an organization. */
      readonly labels: readonly LabelConfiguration[];
      readonly milestones: readonly MilestoneConfiguration[];
    }
  | {
      readonly scope: StorageScope;
      readonly status: "unsupported" | "forbidden" | "unconfigured" | "missing";
      readonly readAt: number;
      readonly message: string;
    };

export interface IssueFieldConfiguration {
  readonly nodeId: string;
  readonly name: string;
  readonly type: "text" | "number" | "date" | "single-select" | "multi-select";
  /** A single-select field's options in GitHub's order; empty for another type. */
  readonly options: readonly ProjectFieldOption[];
}

export interface IssueTypeConfiguration {
  readonly nodeId: string;
  readonly name: string;
  readonly color: ProjectFieldOptionColor | null;
  readonly description: string;
  readonly enabled: boolean;
}

export interface LabelConfiguration {
  readonly nodeId: string;
  readonly name: string;
  /** Six lower-case hexadecimal digits. */
  readonly color: string;
  readonly description: string;
}

export interface MilestoneConfiguration {
  readonly nodeId: string;
  readonly number: number;
  readonly title: string;
  readonly description: string;
  readonly state: "open" | "closed";
}

export type ScopeEntity =
  | IssueFieldConfiguration
  | IssueTypeConfiguration
  | LabelConfiguration
  | MilestoneConfiguration;

export type ScopeEntityWrite =
  | {
      readonly kind: "issue-field-create";
      readonly organization: string;
      readonly name: string;
      readonly type: "text" | "number" | "date" | "single-select";
      readonly options?: readonly ProjectFieldOptionWrite[];
    }
  | {
      readonly kind: "issue-field-update";
      readonly organization: string;
      readonly nodeId: string;
      readonly name?: string;
      readonly options?: readonly ProjectFieldOptionWrite[];
    }
  | { readonly kind: "issue-field-delete"; readonly organization: string; readonly nodeId: string }
  | {
      readonly kind: "issue-type-create";
      readonly organization: string;
      readonly name: string;
      readonly color: ProjectFieldOptionColor;
      readonly description: string;
    }
  | {
      readonly kind: "issue-type-update";
      readonly organization: string;
      readonly nodeId: string;
      readonly name?: string;
      readonly color?: ProjectFieldOptionColor;
      readonly description?: string;
      readonly enabled?: true;
    }
  | {
      readonly kind: "label-create";
      readonly repository: string;
      readonly name: string;
      readonly color: string;
      readonly description: string;
    }
  | {
      readonly kind: "label-update";
      readonly repository: string;
      readonly nodeId: string;
      readonly name?: string;
      readonly color?: string;
      readonly description?: string;
    }
  | { readonly kind: "label-delete"; readonly repository: string; readonly nodeId: string }
  | {
      readonly kind: "milestone-create";
      readonly repository: string;
      readonly title: string;
      readonly description: string;
    }
  | {
      readonly kind: "milestone-update";
      readonly repository: string;
      readonly number: number;
      readonly title?: string;
      readonly description?: string;
    };

export interface TaskFieldWrite {
  /** The invocation of the `github-task-field-set` invoke that asks for the write. */
  readonly actorId: string;
  readonly invokeId: string;
  readonly entryId: string;
  readonly issueNodeId: string;
  readonly projectNodeId: string;
  /** The task field's name, for attribution and errors. */
  readonly field: string;
  readonly storage: TaskFieldStorage;
  /** For a `label` field, the label name of each option; empty otherwise. */
  readonly labels: readonly string[];
  /** For a `label` or `milestone` field, the repositories of the binding's scope; empty otherwise. */
  readonly repositories: readonly string[];
  /** A string, a finite number, or null to clear; an option's name for a single-select field. */
  readonly value: string | number | null;
}
