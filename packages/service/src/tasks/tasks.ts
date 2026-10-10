// ---
// relationships:
//   implements: tasks-api
// ---
import type { Task, TaskSummary, TasksResponse } from "@wyrd-company/manifold-shared/tasks-api";
import type {
  TasksOptions,
  TasksBoundProject,
  TasksTrackedIssue,
  TasksEscalation,
} from "./types.ts";
import type { StoredSnapshot } from "../store/index.ts";
import { actorSummaries } from "../console/actors-api.ts";
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
function identity(snapshot: StoredSnapshot | undefined) {
  const context = snapshot?.snapshot["context"];
  return record(context) && record(context["manifold"]) ? context["manifold"] : {};
}
export function escalationsOfTask(
  escalations: readonly TasksEscalation[],
  task: { actorId: string; issue: { nodeId: string } },
  tokenHolder: TasksOptions["tokenHolder"],
) {
  return escalations.filter((e) =>
    e.raiser.type === "blueprint"
      ? e.raiser.actorId === task.actorId
      : e.raiser.subject["actorId"] === task.actorId ||
        e.raiser.subject["issue"] === task.issue.nodeId ||
        (e.raiser.subject["tokenId"] !== undefined &&
          tokenHolder(e.raiser.subject["tokenId"]) === task.actorId),
  );
}
function status(project: TasksBoundProject, tracked: TasksTrackedIssue) {
  const item = tracked.items.find(
    (i) =>
      !i.archived &&
      i.project.owner.toLowerCase() === project.owner.toLowerCase() &&
      i.project.number === project.number,
  );
  if (!item) return undefined;
  const value = project.lifecycle ? item.fields[project.lifecycle.field] : null;
  return value?.kind === "single-select" ? (value.name ?? null) : null;
}
function actor(snapshot: StoredSnapshot | undefined, held: boolean) {
  if (!snapshot) return undefined;
  const summary = actorSummaries([snapshot])[0]!;
  return {
    status: held
      ? ("held" as const)
      : snapshot.snapshot.status === "error"
        ? ("held" as const)
        : snapshot.snapshot.status,
    states: summary.states,
    machine: summary.machine,
    ...(summary.blueprint ? { blueprint: summary.blueprint } : {}),
    ...(summary.environment !== undefined ? { environment: summary.environment } : {}),
    savedAt: summary.savedAt,
  };
}
export function boardProjects(
  projects: readonly TasksBoundProject[],
  trackedIssues: readonly TasksTrackedIssue[],
  snapshots: ReadonlyMap<string, StoredSnapshot | undefined>,
  escalations: readonly TasksEscalation[],
  held: TasksOptions["held"],
  tokenHolder: TasksOptions["tokenHolder"],
): TasksResponse {
  return {
    projects: projects.map((project) => ({
      ...project,
      tasks: trackedIssues
        .flatMap((tracked) => {
          const lifecycle = status(project, tracked);
          if (lifecycle === undefined) return [];
          const actorId = `task:${tracked.issue.nodeId}`,
            snapshot = snapshots.get(actorId),
            current = actor(snapshot, held(actorId)),
            item = identity(snapshot)["portfolioItem"];
          const task: TaskSummary = {
            actorId,
            issue: issueFields(tracked.issue),
            status: lifecycle,
            ...(typeof item === "string" ? { portfolioItem: item } : {}),
            ...(current ? { actor: { status: current.status, states: current.states } } : {}),
            openEscalations: escalationsOfTask(
              escalations,
              { actorId, issue: tracked.issue },
              tokenHolder,
            ).filter((e) => e.status === "open").length,
          };
          return [task];
        })
        .toSorted((a, b) =>
          a.issue.repository < b.issue.repository
            ? -1
            : a.issue.repository > b.issue.repository
              ? 1
              : a.issue.number - b.issue.number,
        ),
    })),
  };
}
function issueFields(issue: TasksTrackedIssue["issue"]) {
  return {
    nodeId: issue.nodeId,
    repository: issue.repository,
    number: issue.number,
    state: issue.state,
    ...(issue.title !== undefined ? { title: issue.title } : {}),
    ...(issue.url !== undefined ? { url: issue.url } : {}),
  };
}
export function taskDetail(
  actorId: string,
  tracked: TasksTrackedIssue,
  projects: readonly TasksBoundProject[],
  snapshot: StoredSnapshot | undefined,
  escalations: readonly TasksEscalation[],
  reads: Pick<
    TasksOptions,
    "held" | "thread" | "tokenHolder" | "actorUsage" | "accountUnit" | "taskFields"
  >,
): Task | undefined {
  const memberships = projects.flatMap((p) => {
    const value = status(p, tracked);
    return value === undefined
      ? []
      : [
          {
            binding: p.binding,
            owner: p.owner,
            number: p.number,
            ...(p.lifecycle ? { field: p.lifecycle.field } : {}),
            status: value,
            ...(reads.taskFields ? { fields: reads.taskFields(p.binding, tracked) ?? [] } : {}),
          },
        ];
  });
  if (!memberships.length) return undefined;
  const manifold = identity(snapshot),
    current = actor(snapshot, reads.held(actorId)),
    associated = escalationsOfTask(
      escalations,
      { actorId, issue: tracked.issue },
      reads.tokenHolder,
    ),
    usage = reads.actorUsage(actorId);
  const environment =
    typeof manifold["environment"] === "string" ? manifold["environment"] : undefined;
  const threads = Array.isArray(manifold["threads"])
    ? manifold["threads"].filter((v): v is string => typeof v === "string")
    : [];
  return {
    actorId,
    issue: issueFields(tracked.issue),
    projects: memberships,
    ...(typeof manifold["portfolioItem"] === "string"
      ? { portfolioItem: manifold["portfolioItem"] }
      : {}),
    ...(current ? { actor: current } : {}),
    threads: threads.map((threadId) => ({
      threadId,
      ...(environment !== undefined ? { environment, ...reads.thread(environment, threadId) } : {}),
    })),
    usage: {
      settled: usage.settled,
      accounts: usage.accounts.map(({ outstanding, ...account }) => {
        const unit = reads.accountUnit?.(account.account);
        return { ...account, reserved: outstanding, ...(unit ? { unit } : {}) };
      }),
    },
    escalations: {
      open: associated
        .filter((e) => e.status === "open")
        .toSorted((a, b) => a.raisedAt - b.raisedAt),
      recent: associated
        .filter((e) => e.status !== "open")
        .toSorted((a, b) => (b.closedAt ?? 0) - (a.closedAt ?? 0))
        .slice(0, 20),
    },
  };
}
