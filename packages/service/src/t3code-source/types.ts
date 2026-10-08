// ---
// relationships:
//   implements: t3code-environment-source
// ---
import type { BackoffPolicy, Logger } from "@wyrd-company/t3code-client";
import type { Router, RoutedEvent } from "../router/index.ts";
import type { Store } from "../store/index.ts";
export type EnvironmentsConfiguration = Readonly<
  Record<
    string,
    {
      readonly url: string;
      readonly credential: string;
      readonly reconnect: BackoffPolicy;
      readonly heartbeat: { readonly intervalMs: number; readonly missedPongLimit: number };
      readonly openTimeoutMs: number;
    }
  >
>;
export type ThreadChangeEvent = RoutedEvent & {
  readonly environment: string;
  readonly threadId: string;
  readonly projectId: string;
};
export interface MessagePlacement {
  readonly environment: string;
  readonly threadId: string;
  readonly messageId: string;
  readonly turnId: string | null;
  readonly placement: "joined" | "started" | "unknown";
}
export interface T3CodeSourceOptions {
  readonly store: Store;
  readonly router: Router;
  readonly environments: EnvironmentsConfiguration;
  readonly tokenFile: (credential: string) => string;
  readonly messagePlaced?: (placement: MessagePlacement) => void;
  readonly holds?: EnvironmentHolds;
  readonly logger?: Logger;
}
export interface EnvironmentStatus {
  readonly environment: string;
  readonly state: "connecting" | "following" | "retrying" | "disconnected" | "stopped";
  readonly error?: string;
  readonly followedThreads: number;
  readonly activeThreads: number;
  readonly openSubscriptions: number;
}
export interface ThreadView {
  readonly title: string;
  readonly url: string;
  readonly turn?: "running" | "completed" | "interrupted" | "error";
  readonly archived: boolean;
}
export interface T3CodeProjectView {
  readonly id: string;
  readonly title: string;
  readonly workspaceRoot: string;
  readonly activeThreads: number;
}
export interface CreatedProject {
  readonly environment: string;
  readonly projectId: string;
  readonly actorId: string;
  readonly item: string;
}
export interface T3CodeSource {
  platform(
    environment: string,
    signal?: AbortSignal,
  ): Promise<"darwin" | "linux" | "windows" | "unknown">;
  recordCreatedProject(record: CreatedProject): void;
  createdProject(environment: string, projectId: string): CreatedProject | undefined;
  projects(environment: string): readonly T3CodeProjectView[] | undefined;
  thread(environment: string, threadId: string): ThreadView | undefined;
  environmentId(environment: string, signal?: AbortSignal): Promise<string>;
  status(): readonly EnvironmentStatus[];
  ready(environment: string, signal?: AbortSignal): Promise<void>;
  write<T>(
    environment: string,
    threadId: string | null,
    signal: AbortSignal,
    send: (signal: AbortSignal) => Promise<T>,
  ): Promise<T>;
  restart(environment: string): void;
  stop(): Promise<void>;
}

export interface EnvironmentHold {
  readonly paused: boolean;
  readonly disconnected: boolean;
  readonly sequence: number;
}
export interface EnvironmentHolds {
  held(environment: string): EnvironmentHold;
  changed(environment: string, after: number, signal?: AbortSignal): Promise<void>;
}
