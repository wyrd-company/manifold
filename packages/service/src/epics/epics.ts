// ---
// relationships:
//   implements: epics-api
// ---
import type {
  EpicIssue,
  EpicResponse,
  EpicRootsResponse,
  Dependency,
} from "@wyrd-company/manifold-shared/epics-api";
import type { TaskIssue, TasksResponse } from "@wyrd-company/manifold-shared/tasks-api";
import type { EpicTrackedIssue } from "./types.ts";
const publicIssue = (issue: TaskIssue): TaskIssue => ({
  nodeId: issue.nodeId,
  repository: issue.repository,
  number: issue.number,
  state: issue.state,
  ...(issue.title !== undefined ? { title: issue.title } : {}),
  ...(issue.url !== undefined ? { url: issue.url } : {}),
});
const order = (a: TaskIssue, b: TaskIssue) =>
  a.repository.localeCompare(b.repository) || a.number - b.number;
export function epicRoots(tracked: readonly EpicTrackedIssue[]): EpicRootsResponse {
  const ids = new Set(tracked.map((t) => t.issue.nodeId));
  return {
    roots: tracked
      .filter((t) => t.subIssues.length && (!t.parent || !ids.has(t.parent.nodeId)))
      .toSorted(
        (a, b) =>
          Number(a.issue.state === "closed") - Number(b.issue.state === "closed") ||
          order(a.issue, b.issue),
      )
      .map((t) => ({ issue: publicIssue(t.issue) })),
  };
}
export function epicOf(
  nodeId: string,
  tracked: readonly EpicTrackedIssue[],
  tasks: TasksResponse,
): EpicResponse | undefined {
  const byId = new Map(tracked.map((t) => [t.issue.nodeId, t]));
  const root = byId.get(nodeId);
  if (!root) return undefined;
  const issues = new Map<string, EpicIssue>();
  function walk(issue: TaskIssue, parent?: string) {
    if (issues.has(issue.nodeId)) return;
    const current = byId.get(issue.nodeId);
    issues.set(issue.nodeId, {
      issue: publicIssue(current?.issue ?? issue),
      placement: parent ? "tree" : "root",
      ...(parent ? { parent } : {}),
    });
    for (const child of current?.subIssues.toSorted(order) ?? []) walk(child, issue.nodeId);
  }
  walk(root.issue);
  const tree = [...issues.keys()],
    dependencies = new Map<string, Dependency>(),
    outside = new Map<string, TaskIssue>();
  function edge(blocking: TaskIssue, blocked: TaskIssue) {
    dependencies.set(JSON.stringify([blocking.nodeId, blocked.nodeId]), {
      blocking: blocking.nodeId,
      blocked: blocked.nodeId,
    });
    for (const issue of [blocking, blocked])
      if (!issues.has(issue.nodeId))
        outside.set(issue.nodeId, byId.get(issue.nodeId)?.issue ?? issue);
  }
  for (const id of tree) {
    const t = byId.get(id);
    if (!t) continue;
    for (const issue of t.blockedBy) edge(issue, t.issue);
    for (const issue of t.blocking) edge(t.issue, issue);
  }
  for (const issue of [...outside.values()].toSorted(order))
    issues.set(issue.nodeId, { issue: publicIssue(issue), placement: "outside" });
  for (const project of tasks.projects)
    for (const task of project.tasks) {
      const entry = issues.get(task.issue.nodeId);
      if (!entry) continue;
      const previous = entry.task;
      issues.set(task.issue.nodeId, {
        ...entry,
        task: previous
          ? {
              ...previous,
              projects: [...previous.projects, { binding: project.binding, status: task.status }],
            }
          : {
              actorId: task.actorId,
              projects: [{ binding: project.binding, status: task.status }],
              ...(task.actor ? { actor: task.actor } : {}),
              openEscalations: task.openEscalations,
            },
      });
    }
  const positions = new Map([...issues.keys()].map((id, i) => [id, i]));
  return {
    epic: {
      root: nodeId,
      issues: [...issues.values()],
      dependencies: [...dependencies.values()].toSorted(
        (a, b) =>
          positions.get(a.blocked)! - positions.get(b.blocked)! ||
          positions.get(a.blocking)! - positions.get(b.blocking)!,
      ),
    },
  };
}
