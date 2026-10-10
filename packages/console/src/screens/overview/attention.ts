// ---
// relationships:
//   implements: operator-console
// ---
import type { ActorSummary } from "@wyrd-company/manifold-shared/actors-api";
import type { BoundProject } from "@wyrd-company/manifold-shared/tasks-api";
import type { Escalation } from "@wyrd-company/manifold-shared/escalations-api";
import type { EnvironmentSummary } from "@wyrd-company/manifold-shared/environments-api";
export type AttentionTarget =
  | { readonly to: "task"; readonly actorId: string }
  | { readonly to: "blueprint"; readonly path: string }
  | { readonly to: "actor"; readonly actorId: string }
  | { readonly to: "board" | "environments" };
export type AttentionItem =
  | {
      readonly kind: "escalation";
      readonly escalation: Escalation;
      readonly target: AttentionTarget;
    }
  | {
      readonly kind: "held-actor";
      readonly actorId: string;
      readonly title?: string;
      readonly states: readonly string[];
      readonly target: AttentionTarget;
    }
  | {
      readonly kind: "paused-environment";
      readonly environment: EnvironmentSummary;
      readonly target: AttentionTarget;
    };
export function needsAttention(reads: {
  readonly escalations?: readonly Escalation[] | undefined;
  readonly tasks?: readonly BoundProject[] | undefined;
  readonly actors?: readonly ActorSummary[] | undefined;
  readonly environments?: readonly EnvironmentSummary[] | undefined;
}): readonly AttentionItem[] {
  const tasks = new Map(
    (reads.tasks ?? []).flatMap((project) => project.tasks).map((task) => [task.actorId, task]),
  );
  const escalations = (reads.escalations ?? [])
    .filter((e) => e.status === "open")
    .toSorted((a, b) => a.raisedAt - b.raisedAt || a.id.localeCompare(b.id));
  const target = (e: Escalation): AttentionTarget => {
    if (
      e.raiser.type === "service" &&
      (e.raiser.kind === "comparator-failed" || e.raiser.kind === "stranded-token")
    )
      return { to: "blueprint", path: e.raiser.subject["gate"]!.split("#")[0]! };
    const intake = e.raiser.type === "service" && e.raiser.kind === "intake-failed";
    const actorId =
      e.raiser.type === "blueprint"
        ? e.raiser.actorId
        : intake
          ? `task:${e.raiser.subject["issue"]}`
          : e.raiser.subject["actorId"]!;
    return tasks.has(actorId)
      ? { to: "task", actorId }
      : intake
        ? { to: "board" }
        : { to: "actor", actorId };
  };
  const represented = new Set(
    escalations
      .filter((e) => e.raiser.type === "service" && e.raiser.kind === "held-actor")
      .map((e) => (e.raiser.type === "service" ? e.raiser.subject["actorId"] : undefined)),
  );
  const savedAt = new Map(
    (reads.actors ?? []).map((actor) => [actor.actorId, Date.parse(actor.savedAt)]),
  );
  const held = [...tasks.values()]
    .filter((task) => task.actor?.status === "held" && !represented.has(task.actorId))
    .toSorted(
      (a, b) =>
        (savedAt.get(a.actorId) ?? Infinity) - (savedAt.get(b.actorId) ?? Infinity) ||
        a.actorId.localeCompare(b.actorId),
    );
  return [
    ...escalations.map((escalation) => ({
      kind: "escalation" as const,
      escalation,
      target: target(escalation),
    })),
    ...held.map((task) => ({
      kind: "held-actor" as const,
      actorId: task.actorId,
      ...(task.issue.title !== undefined ? { title: task.issue.title } : {}),
      states: task.actor!.states,
      target: { to: "task" as const, actorId: task.actorId },
    })),
    ...(reads.environments ?? [])
      .filter((environment) => environment.paused === true)
      .map((environment) => ({
        kind: "paused-environment" as const,
        environment,
        target: { to: "environments" as const },
      })),
  ];
}
