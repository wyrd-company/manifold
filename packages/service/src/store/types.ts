// ---
// relationships:
//   implements: store
// ---
import type { DatabaseSync } from "node:sqlite";

export interface StoreOptions {
  /** Path of the SQLite file. Created when absent; its directory exists. */
  readonly path: string;
  /** Milliseconds since the Unix epoch. Defaults to Date.now. */
  readonly now?: () => number;
  /** Called at each step of a delivery. */
  readonly probe?: DeliveryProbe;
}

export interface Store {
  readonly connection: StoreConnection;

  saveSnapshot(write: SnapshotWrite): SaveOutcome;
  loadSnapshot(actorId: string): StoredSnapshot | undefined;
  loadErroredSnapshot(actorId: string): StoredErroredSnapshot | undefined;
  findActorsInState(query: StateQuery): StoredSnapshot[];

  writeInbox(event: InboxEvent, actorIds: readonly string[]): InboxRow[];
  pendingInbox(actorId: string): InboxRow[];
  markConsumed(actorId: string, eventId: string): void;
  deliver(target: DeliveryTarget, row: InboxRow): DeliveryOutcome;
  drain(target: DeliveryTarget): DrainResult;

  dueDeadlines(at: number): DeadlineRow[];
  fireDeadline(deadline: DeadlineRow, topic: string): InboxRow | undefined;

  close(): void;
}

export interface StoreConnection {
  readonly database: DatabaseSync;
  transaction<T>(work: () => T): T;
  migrate(owner: string, steps: readonly string[]): void;
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type StateValue = string | { readonly [key: string]: StateValue };

export type PersistedSnapshot =
  | {
      readonly status: "active" | "done" | "stopped";
      readonly value: StateValue;
      readonly [key: string]: unknown;
    }
  | { readonly status: "error"; readonly [key: string]: unknown };

export interface SnapshotWrite {
  readonly actorId: string;
  readonly machine: string;
  readonly snapshot: PersistedSnapshot;
  readonly deadlines?: readonly DeadlineArm[];
  readonly eventId?: string;
}

export type SaveOutcome = "saved" | "errored";

export interface StoredSnapshot {
  readonly actorId: string;
  readonly machine: string;
  readonly snapshot: PersistedSnapshot;
  readonly savedAt: number;
}

export interface StoredErroredSnapshot extends StoredSnapshot {
  readonly eventId: string | undefined;
}

export interface StateQuery {
  readonly machine: string;
  readonly statePath: string;
}

export interface InboxEvent {
  readonly eventId: string;
  readonly topic: string;
  readonly payload: JsonValue;
}

export interface InboxRow extends InboxEvent {
  readonly sequence: number;
  readonly actorId: string;
  readonly receivedAt: number;
  readonly consumedAt: number | undefined;
}

export interface DeliveryTarget {
  readonly actorId: string;
  send(row: InboxRow): void;
  persist(): Omit<SnapshotWrite, "actorId" | "eventId">;
}

export type DeliveryOutcome = "delivered" | "already-consumed" | "errored";

export interface DrainResult {
  readonly delivered: number;
  readonly erroredAt: InboxRow | undefined;
}

export type DeliveryStep = "sent" | "saved";
export type DeliveryProbe = (step: DeliveryStep, row: InboxRow) => void;

export interface DeadlineArm {
  readonly statePath: string;
  readonly eventName: string;
  readonly fireAt: number;
  readonly entryId: string;
}

export interface DeadlineRow extends DeadlineArm {
  readonly deadlineId: number;
  readonly actorId: string;
  readonly firedAt: number | undefined;
}
