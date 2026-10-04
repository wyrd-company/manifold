// ---
// relationships:
//   implements: durable-event-delivery
//   references: router-events
// ---
import type {
  DeliveryTarget,
  InboxRow,
  JsonValue,
  PersistedSnapshot,
  Store,
  StoredSnapshot,
} from "../store/index.ts";

export interface RouterOptions {
  readonly store: Store;
  readonly host: ActorHost;
  /** Defaults to Date.now and setTimeout. */
  readonly clock?: RouterClock;
  /** Runs once, after every restored actor's inbox is drained. */
  readonly afterDrain?: () => void;
  /** Called each time an actor becomes held. */
  readonly onHeld?: (held: HeldActor) => void;
}

export interface Router {
  publish(event: SourceEvent): PublishOutcome;
  attach(target: DeliveryTarget): void;
  persist(actorId: string): void;
  stop(): void;
}

export interface ActorHost {
  subscription(actor: ActorRecord): Subscription;
  /** `router` is the one the restored actor publishes through. */
  restore(stored: StoredSnapshot, router: Router): RestoreOutcome;
}

export interface ActorRecord {
  readonly actorId: string;
  readonly machine: string;
  readonly snapshot: PersistedSnapshot;
}

export interface Subscription {
  readonly topics: readonly string[];
  /** Absent when the blueprint version is not loaded: every type is taken. */
  readonly events?: readonly string[];
}

export type RestoreOutcome =
  | { readonly status: "restored"; readonly target: DeliveryTarget }
  | { readonly status: "held"; readonly reason: string };

export interface HeldActor {
  readonly actorId: string;
  readonly reason: string;
  readonly row: InboxRow | undefined;
}

export interface RouterClock {
  now(): number;
  /** Calls wake once after delay milliseconds; the result cancels it. */
  setTimer(delay: number, wake: () => void): () => void;
}

export interface SourceEvent {
  readonly source: string;
  readonly eventId: string;
  readonly topics: readonly string[];
  readonly event: RoutedEvent;
}

export interface RoutedEvent {
  readonly type: string;
  readonly [key: string]: JsonValue;
}

export type PublishOutcome =
  | {
      readonly status: "accepted";
      /** True when the source event was accepted before. */
      readonly replay: boolean;
      readonly rows: readonly InboxRow[];
    }
  | { readonly status: "rejected"; readonly issues: readonly EventIssue[] };

export interface EventIssue {
  /** RFC 6901 JSON Pointer into the source event. */
  readonly path: string;
  readonly message: string;
}
