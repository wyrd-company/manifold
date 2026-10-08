// ---
// relationships:
//   implements: [tasks-api, operator-console]
// ---
import type { RequestListener } from "node:http";
import type { Store } from "../store/index.ts";
import type {
  TaskResponse,
  TasksResponse,
  TaskIssue,
  TaskThread,
} from "@wyrd-company/manifold-shared/tasks-api";
import type { Escalation } from "@wyrd-company/manifold-shared/escalations-api";
export interface TasksBoundProject {
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly item: string;
  readonly lifecycle?: { readonly field: string; readonly options: readonly string[] };
}
export interface TasksTrackedIssue {
  readonly issue: TaskIssue;
  readonly items: readonly {
    readonly project: { readonly owner: string; readonly number: number };
    readonly archived: boolean;
    readonly fields: Readonly<
      Record<string, { readonly kind: string; readonly name?: string } | null>
    >;
  }[];
}
export interface TasksGitHub {
  trackedIssues(): readonly TasksTrackedIssue[];
}
export interface TasksActorUsage {
  readonly settled: boolean;
  readonly accounts: readonly {
    readonly account: string;
    readonly estimate: number;
    readonly actual: number;
    readonly variance: number;
    readonly outstanding: number;
  }[];
}
export type TasksEscalation = Escalation;
export type TasksThreadView = Omit<TaskThread, "threadId" | "environment">;
export interface TasksOptions {
  readonly store: Pick<Store, "loadSnapshot">;
  held(actorId: string): boolean;
  boundProjects(): readonly TasksBoundProject[];
  readonly github: TasksGitHub;
  actorUsage(actorId: string): TasksActorUsage;
  accountUnit?(account: string): "usd" | undefined;
  listEscalations(filter: {
    readonly status?: "open" | "answered" | "withdrawn";
  }): readonly TasksEscalation[];
  thread(environment: string, threadId: string): TasksThreadView | undefined;
  tokenHolder(tokenId: string): string | undefined;
  readonly log?: (entry: { level: "error"; path: string; error: string }) => void;
}
export interface Tasks {
  list(tracked?: readonly TasksTrackedIssue[]): TasksResponse;
  get(actorId: string): TaskResponse | undefined;
  readonly requestListener: RequestListener;
}
