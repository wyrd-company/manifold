// ---
// relationships:
//   implements: intake
// ---
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type { LoadedBlueprint, RevisionLoad, VersionLoad } from "../blueprint-loader/index.ts";
import type { GitHubProject, TrackedIssue } from "../github-source/index.ts";
import type { PortfolioInForce } from "../portfolio/index.ts";
import type { JsonValue, Store } from "../store/index.ts";
import type { Escalations } from "../escalations/index.ts";
import type { DecisionModels } from "../decision-models.ts";
import type { BlueprintVersion } from "@wyrd-company/manifold-shared";

/** Migration steps for owner `intake`, applied by the store's migrate. */

export interface IntakeOptions {
  readonly store: Store;
  readonly escalations: Pick<Escalations, "raise" | "withdraw">;
  /** The GitHub event source satisfies it. */
  readonly tracked: TrackedIssues;
  /** The blueprint loader satisfies it. */
  readonly blueprints: { version(version: BlueprintVersion): Promise<VersionLoad> };
  /** The basis the service last published, or undefined before the first. */
  current(): IntakeRevision | undefined;
  readonly actors: TaskActorStarter;
  /** Called for each failed decision and each failed start. */
  readonly onFailed?: (record: IntakeRecord) => void;
  /** Called for each failure the runner recovers from by itself. */
  readonly onError?: (error: IntakeError) => void;
  /** Called after each step commits. */
  readonly probe?: (step: IntakeStep, issueNodeId: string) => void;
  /** Builds a commit's decision models. Defaults to createDecisionModels. */
  readonly createModels?: (models: Readonly<Record<string, unknown>>) => DecisionModels;
}

export interface TrackedIssues {
  trackedIssue(nodeId: string): TrackedIssue | undefined;
  trackedIssueIds(): readonly string[];
}

export interface IntakeRevision {
  readonly revision: ProcessRepositoryRevision;
  /** Loaded from `revision`; its commit equals the revision's. */
  readonly blueprints: RevisionLoad;
  /** The portfolio module's declaration in force after `revision` was applied to it. */
  readonly portfolio: PortfolioInForce;
}

/** The start member of the actor host. */
export interface TaskActorStarter {
  start(request: TaskActorStart): void;
}

export interface TaskActorStart {
  readonly actorId: string;
  readonly blueprint: LoadedBlueprint;
  /** `#/$defs/task-input` of `intake-decision-model`. */
  readonly input: { readonly [key: string]: JsonValue };
}

export interface Intake {
  /** Takes in each issue the GitHub event source has committed as tracked. */
  discovered(issueNodeIds: readonly string[]): void;
  /** Reconciles every tracked issue against the revision `current` now answers. */
  revisionLoaded(): void;
  mirrorChanged(): void;
  record(issueNodeId: string): IntakeRecord | undefined;
  /** Resolves when nothing is queued or running. */
  idle(): Promise<void>;
  stop(): Promise<void>;
}

/** `#/$defs/intake-record` of `intake-decision-model`. */
export interface IntakeRecord {
  readonly issueNodeId: string;
  readonly status: "failed" | "recorded" | "started";
  readonly commit: string;
  readonly binding: string | null;
  readonly project: GitHubProject | null;
  readonly environment: string | null;
  readonly blueprintPath: string | null;
  readonly blueprintVersion: string | null;
  readonly portfolioItem: string | null;
  readonly portfolioCommit: string | null;
  readonly actorId: string;
  readonly failure: IntakeFailure | null;
  readonly evaluation: JsonValue | null;
  readonly issueDigest: string | null;
  readonly attempts: number;
  /** The last failure to start the actor of a `recorded` record. */
  readonly startFailure: IntakeStartFailure | null;
  readonly startAttempts: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface IntakeFailure {
  readonly kind: IntakeFailureKind;
  readonly message: string;
  readonly detail: JsonValue;
}

export type IntakeFailureKind =
  | "binding-missing"
  | "binding-archived"
  | "manifest"
  | "decision-model"
  | "output"
  | "blueprint-unloaded"
  | "item-unknown"
  | "item-archived"
  | "item-outside-binding"
  | "input-invalid";

export interface IntakeStartFailure {
  readonly kind: "version-unavailable" | "input-invalid";
  readonly message: string;
  readonly detail: JsonValue;
}

export type IntakeStep = "recorded" | "started" | "failed" | "start-failed";

export class IntakeError extends Error {
  readonly kind: "read" | "start" | "store";
  readonly issueNodeId: string;
  constructor(kind: "read" | "start" | "store", issueNodeId: string, cause: unknown) {
    super(`Intake ${kind} failed for ${issueNodeId}`, { cause });
    this.name = "IntakeError";
    this.kind = kind;
    this.issueNodeId = issueNodeId;
  }
}
