// ---
// relationships:
//   implements: agent-threads
// ---
import type { fromPromise } from "xstate";
import type { Logger } from "@wyrd-company/t3code-client";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import type { EnvironmentsConfiguration } from "../t3code-source/index.ts";
import type { Invocation, ActorHost } from "../actor-host/index.ts";
import type { ManifoldIdentity } from "@wyrd-company/manifold-shared";
export type { Invocation, ManifoldIdentity };
export interface AgentThreadsOptions {
  readonly environments: EnvironmentsConfiguration;
  readonly tokenFile: (credential: string) => string;
  readonly actorOf: ActorHost["actorOf"];
  readonly invocationOf: (args: Parameters<Parameters<typeof fromPromise>[0]>[0]) => Invocation;
  readonly bindingArchived: (project: string) => boolean;
  readonly sourceReady: (environment: string, signal?: AbortSignal) => Promise<void>;
  readonly sourceWrite: <T>(
    environment: string,
    signal: AbortSignal,
    send: () => Promise<T>,
  ) => Promise<T>;
  readonly revisionAt: (commit: string) => Promise<ProcessRepositoryRevision | undefined>;
  readonly probe?: (accepted: AcceptedCommand) => void;
  readonly logger?: Logger;
}
export interface AcceptedCommand {
  readonly implementation: "thread-create" | "turn-start";
  readonly commandId: string;
  readonly sequence: number;
}
export interface AgentThreads {
  readonly implementations: ImplementationRegistry;
  stop(): Promise<void>;
}
export type AgentThreadErrorKind =
  | "input"
  | "environment"
  | "archived"
  | "template"
  | "rejected"
  | "unauthorized";
export interface AgentThreadError {
  readonly name: "AgentThreadError";
  readonly kind: AgentThreadErrorKind;
  readonly message: string;
  readonly serverMessage?: string;
}
export function failure(kind: AgentThreadErrorKind, message: string): AgentThreadError {
  return {
    name: "AgentThreadError",
    kind,
    message,
    ...(kind === "rejected" ? { serverMessage: message } : {}),
  };
}
