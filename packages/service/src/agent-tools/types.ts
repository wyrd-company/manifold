// ---
// relationships:
//   implements: agent-tools
// ---
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import type { RequestListener } from "node:http";
import type { Store } from "../store/index.ts";
import type { Router } from "../router/index.ts";
import type { ActorHost, SaveHook } from "../actor-host/index.ts";
import type { AgentThreads } from "../agent-threads/index.ts";
import type { Escalations, ServiceEscalationHandler } from "../escalations/index.ts";
import type { AgentToolsConfiguration } from "../service-configuration/index.ts";
import type { MessagePlacement } from "../t3code-source/index.ts";
import type { ThreadMessage } from "@wyrd-company/manifold-shared";
export type AgentTaskContext = NonNullable<ThreadMessage["from"]["task"]>;
export interface AgentToolsOptions {
  readonly store: Store;
  readonly configuration: AgentToolsConfiguration;
  readonly environments: ReadonlySet<string>;
  readonly router: () => Router;
  readonly escalations: () => Pick<Escalations, "raise" | "withdraw">;
  readonly actors: () => Pick<
    ActorHost,
    "followers" | "followedThreads" | "eventSchema" | "issueThreads" | "actorOf"
  >;
  readonly threads: Pick<AgentThreads, "readThread" | "runningThreads" | "startTurn">;
  readonly sourceReady: (environment: string) => boolean;
  readonly trackedIssue: (nodeId: string) => AgentTaskContext | undefined;
  readonly environmentId: (environment: string, signal?: AbortSignal) => Promise<string>;
  readonly probe?: (committed: CommittedCall) => void;
  readonly clock?: { now(): number; sleep(ms: number, signal?: AbortSignal): Promise<void> };
  readonly log: (entry: {
    readonly level: "info" | "warn" | "error";
    readonly event: string;
    readonly message: string;
  }) => void;
}
export interface CommittedCall {
  readonly tool: "handoff" | "escalate" | "get-messages";
  readonly eventId: string;
  readonly replay: boolean;
}
export interface AgentTools {
  readonly implementations: ImplementationRegistry;
  readonly requestListener: RequestListener;
  readonly questionHandler: ServiceEscalationHandler;
  readonly messagePlaced: (placement: MessagePlacement) => void;
  readonly saving: SaveHook;
  start(): void;
  stop(): Promise<void>;
}
export interface CallRequest {
  environment: string;
  tool: "handoff" | "escalate" | "get-messages";
  arguments: Record<string, unknown>;
  meta: Record<string, unknown>;
}
export interface Identity {
  environment: string;
  environmentId: string;
  threadId: string;
  turnId: string;
}
export interface Refusal {
  status: "refused";
  code: string;
  message: string;
  issues?: { path: string; message: string }[];
}
export class CallRefused extends Error {
  readonly response: Refusal;
  readonly status: number;
  constructor(response: Refusal, status = 409) {
    super(response.message);
    this.response = response;
    this.status = status;
    this.name = "CallRefused";
  }
}
export function refuse(
  code: string,
  message: string,
  status = 409,
  issues?: Refusal["issues"],
): never {
  throw new CallRefused(
    { status: "refused", code, message, ...(issues?.length ? { issues } : {}) },
    status,
  );
}
