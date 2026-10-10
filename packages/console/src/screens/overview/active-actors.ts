// ---
// relationships:
//   implements: operator-console
// ---
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
import type { BoundProject, TaskThread } from "@wyrd-company/manifold-shared/tasks-api";
import type { Escalation } from "@wyrd-company/manifold-shared/escalations-api";
export interface ActiveActorRow {
  readonly actor: ActorSummary;
  readonly task?: { readonly title?: string; readonly reference: string };
  readonly status: "running" | "held";
}
export function activeActorRows(
  actors: readonly ActorSummary[],
  tasks: readonly BoundProject[] | undefined,
  escalations: readonly Escalation[] | undefined,
): readonly ActiveActorRow[] {
  const summaries = tasks?.flatMap((project) => project.tasks) ?? [];
  const held = new Set(
    summaries.filter((task) => task.actor?.status === "held").map((task) => task.actorId),
  );
  for (const escalation of escalations ?? [])
    if (
      escalation.status === "open" &&
      escalation.raiser.type === "service" &&
      escalation.raiser.kind === "held-actor"
    )
      held.add(escalation.raiser.subject["actorId"]!);
  const byId = new Map(summaries.map((task) => [task.actorId, task]));
  return actors.map((actor) => {
    const task = byId.get(actor.actorId);
    return {
      actor,
      status: held.has(actor.actorId) ? "held" : "running",
      ...(task
        ? {
            task: {
              ...(task.issue.title !== undefined ? { title: task.issue.title } : {}),
              reference: `${task.issue.repository}#${task.issue.number}`,
            },
          }
        : {}),
    };
  });
}
export function currentThread(threads: readonly TaskThread[]): TaskThread | undefined {
  return (
    threads.findLast((thread) => thread.url && !thread.archived) ??
    threads.findLast((thread) => thread.url)
  );
}
export function elapsedLabel(ms: number): string {
  return ms < 60000
    ? "<1m"
    : ms < 3600000
      ? `${Math.floor(ms / 60000)}m`
      : ms < 172800000
        ? `${Math.floor(ms / 3600000)}h`
        : `${Math.floor(ms / 86400000)}d`;
}
