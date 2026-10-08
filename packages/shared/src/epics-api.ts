// ---
// relationships:
//   implements: epics-api
// ---
import { array, natural, nonempty, oneOf, shape, string, uri } from "./api-guards.ts";
import type { TaskIssue, TaskSummary } from "./tasks-api.ts";
export const epicsApiPath = "/api/epics";
export interface EpicTask {
  readonly actorId: string;
  readonly projects: readonly { readonly binding: string; readonly status: string | null }[];
  readonly actor?: TaskSummary["actor"];
  readonly openEscalations: number;
}
export interface EpicIssue {
  readonly issue: TaskIssue;
  readonly placement: "root" | "tree" | "outside";
  readonly parent?: string;
  readonly task?: EpicTask;
}
export interface Dependency {
  readonly blocking: string;
  readonly blocked: string;
}
export interface Epic {
  readonly root: string;
  readonly issues: readonly EpicIssue[];
  readonly dependencies: readonly Dependency[];
}
export interface EpicResponse {
  readonly epic: Epic;
}
export interface EpicRootsResponse {
  readonly roots: readonly { readonly issue: TaskIssue }[];
}
const issue = (v: unknown) =>
  shape(
    v,
    {
      nodeId: nonempty,
      repository: (v) => string(v) && /^[^/]+\/[^/]+$/.test(v),
      number: (v) => natural(v) && Number(v) > 0,
      state: oneOf("open", "closed"),
    },
    { title: string, url: uri },
  );
export function isEpicRootsResponse(v: unknown): v is EpicRootsResponse {
  return shape(v, { roots: array((v) => shape(v, { issue })) });
}
const project = (v: unknown) =>
  shape(v, { binding: nonempty, status: (v) => v === null || string(v) });
const actor = (v: unknown) =>
  shape(v, { status: oneOf("active", "done", "stopped", "held"), states: array(nonempty) });
const task = (v: unknown) =>
  shape(
    v,
    {
      actorId: (v) => string(v) && /^task:.+$/.test(v),
      projects: (v) => Array.isArray(v) && v.length > 0 && v.every(project),
      openEscalations: natural,
    },
    { actor },
  );
const epicIssue = (v: unknown) =>
  shape(v, { issue, placement: oneOf("root", "tree", "outside") }, { parent: nonempty, task });
export function isEpicResponse(v: unknown): v is EpicResponse {
  return shape(v, {
    epic: (v) =>
      shape(v, {
        root: nonempty,
        issues: (v) => Array.isArray(v) && v.length > 0 && v.every(epicIssue),
        dependencies: array((v) => shape(v, { blocking: nonempty, blocked: nonempty })),
      }),
  });
}
