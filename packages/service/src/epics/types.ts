// ---
// relationships:
//   implements: epics-api
// ---
import type { RequestListener } from "node:http";
import type { EpicResponse, EpicRootsResponse } from "@wyrd-company/manifold-shared/epics-api";
import type { TaskIssue, TasksResponse } from "@wyrd-company/manifold-shared/tasks-api";
export interface EpicTrackedIssue {
  readonly issue: TaskIssue;
  readonly blockedBy: readonly TaskIssue[];
  readonly blocking: readonly TaskIssue[];
  readonly subIssues: readonly TaskIssue[];
  readonly parent?: TaskIssue | undefined;
}
export interface EpicsGitHub {
  trackedIssueIds(): readonly string[];
  trackedIssue(nodeId: string): EpicTrackedIssue | undefined;
}
export interface EpicsOptions {
  readonly github: EpicsGitHub;
  readonly tasks: { list(): TasksResponse };
  readonly log?: (entry: { level: "error"; path: string; error: string }) => void;
}
export interface Epics {
  roots(): EpicRootsResponse;
  get(issueNodeId: string): EpicResponse | undefined;
  readonly requestListener: RequestListener;
}
