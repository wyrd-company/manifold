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
export interface T3CodeSourceOptions {
  readonly store: Store;
  readonly router: Router;
  readonly environments: EnvironmentsConfiguration;
  readonly tokenFile: (credential: string) => string;
  readonly logger?: Logger;
}
export interface EnvironmentStatus {
  readonly environment: string;
  readonly state: "connecting" | "following" | "retrying" | "stopped";
  readonly error?: string;
  readonly followedThreads: number;
  readonly openSubscriptions: number;
}
export interface ThreadView {
  readonly title: string;
  readonly url: string;
  readonly turn?: "running" | "completed" | "interrupted" | "error";
  readonly archived: boolean;
}
export interface T3CodeSource {
  thread(environment: string, threadId: string): ThreadView | undefined;
  status(): readonly EnvironmentStatus[];
  ready(environment: string, signal?: AbortSignal): Promise<void>;
  write<T>(
    environment: string,
    threadId: string,
    signal: AbortSignal,
    send: (signal: AbortSignal) => Promise<T>,
  ): Promise<T>;
  stop(): Promise<void>;
}
