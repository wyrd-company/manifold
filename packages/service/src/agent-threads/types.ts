// ---
// relationships:
//   implements: agent-threads
// ---
import type { Logger } from "@wyrd-company/t3code-client";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import type { EnvironmentsConfiguration } from "../t3code-source/index.ts";
// Structural stand-ins for actor-host until its implementation joins the branch.
export interface Invocation {
  readonly actorId: string;
  readonly invokeId: string;
  readonly entryId: string;
}
export interface ManifoldIdentity {
  readonly environment?: string;
  readonly project?: string;
  readonly threads?: readonly string[];
}
export interface AgentThreadsOptions {
  readonly environments: EnvironmentsConfiguration;
  readonly tokenFile: (credential: string) => string;
  readonly actorOf: (
    actorId: string,
  ) => { readonly manifold: ManifoldIdentity; readonly commit: string } | undefined;
  readonly invocationOf: (args: { readonly self: { readonly id: string } }) => Invocation;
  readonly bindingArchived: (project: string) => boolean;
  readonly sourceReady: (environment: string, signal?: AbortSignal) => Promise<void>;
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
