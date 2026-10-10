// ---
// relationships:
//   implements: epics-api
// ---
import type { TasksTrackedIssue } from "../tasks/types.ts";
import type { RequestListener } from "node:http";
import type { EpicResponse, EpicRootsResponse } from "@wyrd-company/manifold-shared/epics-api";
import type { TaskIssue, TasksResponse } from "@wyrd-company/manifold-shared/tasks-api";
export interface EpicTrackedIssue extends TasksTrackedIssue {
  readonly blockedBy: readonly TaskIssue[];
  readonly blocking: readonly TaskIssue[];
  readonly subIssues: readonly TaskIssue[];
  readonly parent?: TaskIssue | undefined;
}
export interface EpicsGitHub {
  trackedIssues(): readonly EpicTrackedIssue[];
}
export interface EpicsOptions {
  readonly github: EpicsGitHub;
  readonly tasks: { list(tracked: readonly EpicTrackedIssue[]): TasksResponse };
  readonly log?: (entry: { level: "error"; path: string; error: string }) => void;
}
export interface Epics {
  roots(): EpicRootsResponse;
  get(issueNodeId: string): EpicResponse | undefined;
  readonly requestListener: RequestListener;
}
