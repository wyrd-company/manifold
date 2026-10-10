// ---
// relationships:
//   implements: task-metadata
// ---
import { scopeKey } from "@wyrd-company/manifold-shared";
import type {
  ScopeEntityWrite,
  LabelConfiguration,
  MilestoneConfiguration,
} from "../github-source/index.ts";
import type { EntityTarget, ScopeInput, ScopePlan, PlanChange } from "./project-types.ts";
const target = (entity: LabelConfiguration | MilestoneConfiguration): EntityTarget =>
  "title" in entity
    ? { entity: "milestone", name: entity.title, description: entity.description }
    : { entity: "label", name: entity.name, color: entity.color, description: entity.description };
/** A repository owns the union of named entities and non-empty label prefixes. */
export function planRepositoryConfiguration(input: ScopeInput): ScopePlan | undefined {
  if (input.scope.kind !== "repository") return;
  if (input.observed && input.observed.status !== "ready")
    return { changes: [], writes: [], applied: undefined };
  const repository = input.scope.repository;
  const configuration = input.observed ?? {
    scope: input.scope,
    status: "ready" as const,
    readAt: 0,
    issueFields: [],
    issueTypes: [],
    labels: [],
    milestones: [],
  };
  const scope = { kind: input.scope.kind, name: repository, bindings: input.bindings };
  const changes: PlanChange[] = [];
  const writes: { write: ScopeEntityWrite; changes: readonly PlanChange[] }[] = [];
  const owned: Record<string, string> = {};
  const matched = new Set<string>();
  for (const entity of input.owned.entities) {
    if (entity.storage !== "label" && entity.storage !== "milestone") continue;
    const labels = entity.storage === "label";
    const candidates = labels ? configuration.labels : configuration.milestones;
    const id = input.applied?.owned[entity.key];
    const observed =
      candidates.find((c) => c.nodeId === id) ??
      candidates.find((c) =>
        labels
          ? target(c).name.toLowerCase() === entity.name.toLowerCase()
          : target(c).name === entity.name,
      );
    if (observed) {
      owned[entity.key] = observed.nodeId;
      matched.add(observed.nodeId);
    }
    const from = observed ? target(observed) : null;
    const to: EntityTarget = {
      entity: entity.storage,
      name: entity.name,
      description: entity.description ?? "",
      ...(labels ? { color: entity.color ?? "ededed" } : {}),
    };
    const properties: PlanChange["properties"][number][] = [];
    if (from && from.name !== to.name) properties.push("name");
    if (from && entity.color !== undefined && from.color !== to.color) properties.push("color");
    if (from && entity.description !== undefined && from.description !== to.description)
      properties.push("description");
    if (from && !properties.length) continue;
    const previous = input.applied?.configuration;
    const before =
      previous?.status === "ready"
        ? (labels ? previous.labels : previous.milestones).find((c) => c.nodeId === id)
        : undefined;
    const drift =
      !!before &&
      (!from ||
        (["name", "color", "description"] as const).some(
          (property) =>
            properties.includes(property) && target(before)[property] !== from[property],
        ));
    // Only an entity each declaring field can represent may be accepted.
    const canAccept =
      entity.whenChanged === "accept" &&
      drift &&
      !!from &&
      (labels
        ? (entity.labelPrefixes ?? [""]).every(
            (prefix) =>
              from.name.startsWith(prefix) && /^\S(?:.*\S)?$/.test(from.name.slice(prefix.length)),
          )
        : /^\S(?:.*\S)?$/.test(from.name)) &&
      !input.owned.entities.some(
        (other) =>
          other !== entity &&
          other.storage === entity.storage &&
          (labels
            ? other.name.toLowerCase() === from!.name.toLowerCase()
            : other.name === from!.name),
      );
    const change: PlanChange = {
      id: `${scopeKey(input.scope)}:${entity.key}:${observed ? "change" : "create"}`,
      storage: entity.storage,
      scope,
      target: {
        field: entity.name,
        lifecycle: false,
        ...(entity.declarations[0] ? { taskField: entity.declarations[0].field } : {}),
      },
      description: `${canAccept ? "Accept" : observed ? "Change" : "Create"} ${entity.storage} ${entity.name}.`,
      action: observed ? "change" : "create",
      side: canAccept ? "declaration" : "github",
      drift,
      requiresRemoval: false,
      properties,
      from,
      to: canAccept ? from : to,
    };
    changes.push(change);
    if (canAccept) continue;
    const write: ScopeEntityWrite = labels
      ? observed
        ? {
            kind: "label-update",
            repository,
            nodeId: observed.nodeId,
            ...(properties.includes("name") ? { name: to.name } : {}),
            ...(properties.includes("color") ? { color: to.color! } : {}),
            ...(properties.includes("description") ? { description: to.description } : {}),
          }
        : {
            kind: "label-create",
            repository,
            name: to.name,
            color: to.color!,
            description: to.description,
          }
      : observed && "number" in observed
        ? {
            kind: "milestone-update",
            repository,
            number: observed.number,
            ...(properties.includes("name") ? { title: to.name } : {}),
            ...(properties.includes("description") ? { description: to.description } : {}),
          }
        : { kind: "milestone-create", repository, title: to.name, description: to.description };
    writes.push({ write, changes: [change] });
  }
  const names = new Set(
    input.owned.entities.filter((e) => e.storage === "label").map((e) => e.name.toLowerCase()),
  );
  for (const label of configuration.labels) {
    if (
      matched.has(label.nodeId) ||
      names.has(label.name.toLowerCase()) ||
      !input.owned.prefixes.some((prefix) =>
        label.name.toLowerCase().startsWith(prefix.toLowerCase()),
      )
    )
      continue;
    const change: PlanChange = {
      id: `${scopeKey(input.scope)}:label:${label.nodeId}:remove`,
      storage: "label",
      scope,
      target: { field: label.name, lifecycle: false },
      description: `Remove undeclared label ${label.name}.`,
      action: "remove",
      side: "github",
      drift:
        input.applied?.configuration.status === "ready" &&
        !input.applied.configuration.labels.some((previous) => previous.nodeId === label.nodeId),
      requiresRemoval: true,
      properties: [],
      from: target(label),
      to: null,
    };
    changes.push(change);
    writes.push({
      write: { kind: "label-delete", repository, nodeId: label.nodeId },
      changes: [change],
    });
  }
  return { changes, writes, applied: input.observed ? { configuration, owned } : undefined };
}
