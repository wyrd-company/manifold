// ---
// relationships:
//   implements: github-event-source
// ---
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
  readonly configuration: GitHubConfiguration;
  readonly credentials: Credentials;
  readonly store: Store;
  readonly router: Router;
  readonly boundProjects: () => readonly ProjectReference[];
  readonly processRepository: ProcessRepositoryTrigger;
  readonly clock?: RouterClock;
  readonly onError?: (error: GitHubSourceError) => void;
  readonly probe?: () => void;
  readonly onTracked?: (issueNodeIds: readonly string[]) => void;
}
export interface GitHubSource {
  receive(delivery: WebhookDelivery): DeliveryOutcome;
  readonly requestListener: (request: IncomingMessage, response: ServerResponse) => void;
  requestSweep(): void;
  trackedIssue(nodeId: string): TrackedIssue | undefined;
  trackedIssueIds(): readonly string[];
  stop(): Promise<void>;
}
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
