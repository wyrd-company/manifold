// ---
// relationships:
//   implements: gate-runtime
// ---
import type { TokenLintResult } from "@wyrd-company/manifold-shared";
import type { ActorSave } from "../actor-host/index.ts";
import type { Escalations, Escalation } from "../escalations/index.ts";
import type { BlueprintDocument } from "@wyrd-company/manifold-shared";
import type {
  ComparatorSandbox,
  ComparatorEvaluation,
  ComparatorInputData,
} from "../comparator-sandbox/index.ts";
import type { Ledger } from "../ledger/index.ts";
import type { Store } from "../store/index.ts";
import type { Router } from "../router/index.ts";
export interface GateBlueprint {
  readonly key: string;
  readonly document: BlueprintDocument;
}
export type GateVersionLoad =
  | { readonly status: "loaded"; readonly blueprint: GateBlueprint }
  | { readonly status: "missing" | "invalid" };
export interface GateRevisionLoad {
  readonly blueprints: ReadonlyMap<string, GateBlueprint>;
}
export interface GateRevision {
  readonly commit: string;
  read(path: string): Promise<string | undefined>;
}
export interface GatePortfolio {
  readonly ledger: Pick<Ledger, "reserve" | "balance">;
  current(): {
    readonly declaration: {
      readonly ledger: {
        readonly items: readonly { readonly id: string }[];
        readonly allocations: readonly { readonly account: string }[];
      };
    };
  };
}
export type GateTokenLint = TokenLintResult;
export interface GateTrackedIssue {
  readonly issue: { readonly nodeId: string; readonly state: "open" | "closed" };
  readonly blocking: readonly { readonly nodeId: string; readonly state: "open" | "closed" }[];
}
export type GateEscalations = Pick<Escalations, "raise" | "withdraw">;
export type GateStrandedEscalation = Pick<Escalation, "raiser" | "answer">;
export interface GatesOptions {
  readonly store: Store;
  version(version: { commit: string; path: string }): Promise<GateVersionLoad>;
  revisionAt(commit: string): Promise<GateRevision | undefined>;
  readonly sandbox: ComparatorSandbox;
  readonly portfolio: GatePortfolio;
  lintTokens(document: BlueprintDocument): GateTokenLint;
  trackedIssue(nodeId: string): GateTrackedIssue | undefined;
  readonly escalations: GateEscalations;
  readonly clock?: { now(): number };
  readonly seed?: () => number;
  readonly probe?: (step: "granting" | "granted" | "comparator-failed", tokenId: string) => void;
  readonly onError?: (error: GateError) => void;
}
export interface Gates {
  revision(load: GateRevisionLoad, revision: GateRevision): Promise<void>;
  prepare(): Promise<void>;
  afterDrain(router: Pick<Router, "schedule">): void;
  saved(save: GateSave): void;
  strandedToken(escalation: GateStrandedEscalation): (() => void) | undefined;
  comparatorFailed(escalation: GateStrandedEscalation): (() => void) | undefined;
  inputChanged(): void;
  replay(evaluationId: number): Promise<GateReplay>;
  heldTokens(actorId: string): readonly { gate: string; tokenId: string }[];
  tokenHolder(tokenId: string): string | undefined;
  stop(): void;
}
export type GateSave = ActorSave;
export interface GateError {
  readonly gate: string | undefined;
  readonly version: string | undefined;
  readonly message: string;
}
export type GateEvaluationResult =
  | {
      readonly ok: true;
      readonly selection:
        | import("@wyrd-company/manifold-shared/comparator.d.ts").ComparatorSelection
        | null;
      readonly durationMs: number;
    }
  | {
      readonly ok: false;
      readonly failure: {
        readonly kind:
          | import("../comparator-sandbox/index.ts").ComparatorFailure["kind"]
          | "reservation";
        readonly message: string;
      };
      readonly durationMs: number;
    };
export interface GateReplay {
  readonly recorded: GateEvaluationResult;
  readonly replayed: ComparatorEvaluation;
}
export interface GateDeclaration {
  readonly statePath: string;
  readonly comparator: string;
  readonly reservation: boolean;
  readonly returnPoint: "exit" | { readonly state: string };
  readonly token: string;
  readonly dependencies?: string;
}
export interface GateVersion {
  readonly blueprint: GateBlueprint;
  readonly declarations: readonly GateDeclaration[];
  readonly lint: GateTokenLint;
}
export interface EvaluationRow {
  readonly evaluation_id: number;
  readonly gate: string;
  readonly version: string;
  readonly seed: number;
  readonly input: string;
  readonly outcome: string;
  readonly selection: string | null;
  readonly failure_kind: string | null;
  readonly failure_message: string | null;
  readonly duration_ms: number;
}
export interface EntryRow {
  readonly entry_id: number;
  readonly gate: string;
  readonly actor_id: string;
  readonly state_entry_id: string | null;
  readonly entered_at: number;
}
export interface TokenRow {
  readonly token_id: string;
  readonly gate: string;
  readonly actor_id: string;
  readonly entry_id: number;
  readonly state_entry_id: string | null;
  readonly trapped: number;
  readonly returned_at: number | null;
}
export type GateInput = ComparatorInputData;
