// ---
// relationships:
//   implements: agent-threads
// ---
import type { fromPromise } from "xstate";
import type { OrchestrationThread } from "@wyrd-company/t3code-client";
import type { Logger } from "@wyrd-company/t3code-client";
import type { ProcessRepositoryRevision } from "@wyrd-company/manifold-shared";
import type { ImplementationRegistry } from "../blueprint-loader/index.ts";
import type {
  CreatedProject,
  EnvironmentHolds,
  EnvironmentsConfiguration,
} from "../t3code-source/index.ts";
import type { Invocation, ActorHost } from "../actor-host/index.ts";
import type { ManifoldIdentity } from "@wyrd-company/manifold-shared";
export type { Invocation, ManifoldIdentity };
export interface AgentThreadsOptions {
  readonly environments: EnvironmentsConfiguration;
  readonly holds?: EnvironmentHolds;
  readonly tokenFile: (credential: string) => string;
  readonly actorOf: ActorHost["actorOf"];
  readonly invocationOf: (args: Parameters<Parameters<typeof fromPromise>[0]>[0]) => Invocation;
  readonly bindingArchived: (project: string) => boolean;
  readonly sourceReady: (environment: string, signal?: AbortSignal) => Promise<void>;
  readonly sourceWrite: <T>(
    environment: string,
    threadId: string | null,
    signal: AbortSignal,
    send: (signal: AbortSignal) => Promise<T>,
  ) => Promise<T>;
  readonly sourcePlatform: (
    environment: string,
    signal?: AbortSignal,
  ) => Promise<"darwin" | "linux" | "windows" | "unknown">;
  readonly recordProject: (record: CreatedProject) => void;
  readonly revisionAt: (commit: string) => Promise<ProcessRepositoryRevision | undefined>;
  readonly sending?: (command: SendingCommand) => void;
  readonly probe?: (accepted: InvokedCommand) => void;
  readonly logger?: Logger;
}
interface SendingIdentity {
  readonly invocation: Invocation;
  readonly commandId: string;
  readonly environment: string;
}
export type SendingCommand = SendingIdentity &
  (
    | { readonly implementation: "t3code-project-create"; readonly projectId: string }
    | {
        readonly implementation: "thread-create" | "turn-start";
        readonly threadId: string;
        readonly messageId?: string;
      }
  );
export type InvokedCommand = SendingCommand & { readonly sequence: number };
export interface AcceptedCommand {
  readonly implementation: "t3code-project-create" | "thread-create" | "turn-start";
  readonly commandId: string;
  readonly sequence: number;
}
export interface AgentThreads {
  readonly implementations: ImplementationRegistry;
  scheduled(environment: string): number;
  readThread(
    environment: string,
    threadId: string,
    signal?: AbortSignal,
  ): Promise<OrchestrationThread | null>;
  runningThreads(
    environment: string,
    signal?: AbortSignal,
  ): Promise<readonly OrchestrationThread[]>;
  startTurn(request: {
    readonly environment: string;
    readonly threadId: string;
    readonly messageId: string;
    readonly text: string;
    readonly signal?: AbortSignal;
  }): Promise<{ readonly sequence: number }>;
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
