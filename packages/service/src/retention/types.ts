// ---
// relationships:
//   implements: retention
// ---
import type { Store } from "../store/index.ts";
import type { History } from "../history/index.ts";
import type { Escalations } from "../escalations/index.ts";
import type { RetentionConfiguration } from "../service-configuration/index.ts";
import type { ServiceLogEntry } from "../service/types.ts";
export interface RetentionOptions {
  readonly store: Store;
  readonly history: Pick<History, "prune">;
  readonly escalations: Pick<Escalations, "list">;
  readonly configuration: RetentionConfiguration;
  readonly environments: readonly string[];
  readonly log: (entry: ServiceLogEntry) => void;
  readonly clock?: RetentionClock;
  readonly probe?: (step: PruneStep, id: string) => void;
}
export interface RetentionClock {
  now(): number;
  setTimer(delay: number, wake: () => void): () => void;
  yield(next: () => void): void;
}
export interface Retention {
  prune(): Promise<PruneResult>;
  start(): void;
  stop(): Promise<void>;
}
export interface PruneResult {
  readonly actors: number;
  readonly inboxRows: number;
  readonly historyRows: number;
  readonly sourceEvents: number;
  readonly gateEvaluations: number;
  readonly deliveries: number;
  readonly redeliveries: number;
  readonly escalations: number;
  readonly notifications: number;
  readonly answers: number;
  readonly messages: number;
  readonly cardMoves: number;
  readonly createdProjects: number;
}

export type PruneStep = "actor-pruned" | "escalation-pruned" | "project-retired" | "batch-pruned";
