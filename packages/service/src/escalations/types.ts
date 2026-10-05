// ---
// relationships:
//   implements: escalation-contract
// ---
import type { RequestListener } from "node:http";
import type { CallbackActorLogic, EventObject } from "xstate";
import type { Store } from "../store/index.ts";
import type { ActorSave, Invocation } from "../actor-host/index.ts";
import { invocationOf } from "../actor-host/index.ts";
export type { Invocation } from "../actor-host/index.ts";
import type { EscalationsConfiguration } from "../service-configuration/index.ts";
export type ServiceEscalationKind =
  | "held-actor"
  | "stranded-token"
  | "intake-failed"
  | "comparator-failed";
export type EscalationSubject = Readonly<Record<string, string>>;
export type ServiceEscalationHandler = (escalation: Escalation) => void | (() => void);
export interface EscalationsOptions {
  readonly store: Store;
  readonly configuration: EscalationsConfiguration;
  readonly tokenFile: (credential: string) => string;
  readonly handlers: Readonly<Record<ServiceEscalationKind, ServiceEscalationHandler>>;
  readonly clock?: { now(): number };
  readonly fetch?: typeof globalThis.fetch;
  readonly logger?: { warn(message: string): void; error(message: string): void };
  /** Override invocation resolution in isolated module tests. */
  readonly invocationOf?: typeof invocationOf;
}
export interface EscalationChoice {
  readonly id: string;
  readonly label: string;
}
export interface EscalateInput {
  readonly question: string;
  readonly title?: string;
  readonly choices?: readonly EscalationChoice[];
  readonly freeText?: boolean;
  readonly destinations?: readonly string[];
}
export interface ServiceEscalationRequest {
  readonly kind: ServiceEscalationKind;
  readonly title?: string;
  readonly subject: EscalationSubject;
  readonly question: string;
  readonly choices: readonly EscalationChoice[];
}
export type EscalationStatus = "open" | "answered" | "withdrawn";
export type EscalationChannel = "link" | "api";
export type EscalationAnswer = { readonly choice: string } | { readonly text: string };
export interface Escalation {
  readonly id: string;
  readonly raiser:
    | ({ readonly type: "blueprint" } & Invocation)
    | {
        readonly type: "service";
        readonly kind: ServiceEscalationKind;
        readonly subject: EscalationSubject;
        readonly occurrence: number;
      };
  readonly title: string;
  readonly question: string;
  readonly choices: readonly EscalationChoice[];
  readonly freeText: boolean;
  readonly destinations: readonly string[];
  readonly status: EscalationStatus;
  readonly answer?: {
    readonly value: EscalationAnswer;
    readonly channel: EscalationChannel;
    readonly at: number;
  };
  readonly raisedAt: number;
  readonly closedAt?: number;
}
export type AnswerOutcome =
  | { readonly status: "answered" | "closed"; readonly escalation: Escalation }
  | { readonly status: "invalid"; readonly reason: string }
  | { readonly status: "not-found" };
export type EscalationSave = ActorSave;
export interface Escalations {
  readonly escalate: CallbackActorLogic<EventObject, EscalateInput>;
  saving(save: EscalationSave): void;
  raise(request: ServiceEscalationRequest): Escalation;
  withdraw(request: {
    readonly kind: ServiceEscalationKind;
    readonly subject: EscalationSubject;
  }): void;
  answer(id: string, answer: EscalationAnswer, channel: EscalationChannel): AnswerOutcome;
  get(id: string): Escalation | undefined;
  list(filter: { readonly status?: EscalationStatus }): readonly Escalation[];
  readonly requestListener: RequestListener;
  readonly apiListener: RequestListener;
  start(): void;
  stop(): Promise<void>;
}
export class EscalationInputError extends Error {
  readonly issues: readonly string[];
  constructor(issues: readonly string[]) {
    super(issues.join("; "));
    this.issues = issues;
    this.name = "EscalationInputError";
  }
}
