// ---
// relationships:
//   implements: task-metadata
// ---
import { scopeKey } from "@wyrd-company/manifold-shared";
import type { OwnedEntity } from "@wyrd-company/manifold-shared";
import type {
  ScopeEntity,
  ScopeEntityWrite,
  ProjectFieldOptionColor,
} from "../github-source/index.ts";
import type {
  ScopeInput,
  ScopePlan,
  PlanChange,
  FieldTarget,
  EntityTarget,
} from "./project-types.ts";
import { canonical } from "./plan.ts";
function entities(input: ScopeInput, kind: OwnedEntity["storage"]): readonly ScopeEntity[] {
  if (input.observed?.status !== "ready") return [];
  const configuration = input.observed;
  return kind === "issue-field"
    ? configuration.issueFields
    : kind === "issue-type"
      ? configuration.issueTypes
      : kind === "label"
        ? configuration.labels
        : configuration.milestones;
}
const nameOf = (entity: ScopeEntity) => ("title" in entity ? entity.title : entity.name);
function target(entity: ScopeEntity, kind: OwnedEntity["storage"]): FieldTarget | EntityTarget {
  if ("type" in entity)
    return {
      name: entity.name,
      type: entity.type,
      options: entity.options.map((option) => ({
        name: option.name,
        color: option.color,
        description: option.description,
      })),
    };
  return {
    entity: kind as EntityTarget["entity"],
    name: nameOf(entity),
    description: entity.description,
    ...("color" in entity && entity.color !== null ? { color: entity.color } : {}),
    ...("enabled" in entity ? { enabled: entity.enabled } : {}),
  };
}
function desired(entity: OwnedEntity): FieldTarget | EntityTarget {
  if (entity.storage === "issue-field")
    return {
      name: entity.name,
      type: entity.type!,
      ...(entity.options
        ? {
            options: entity.options.map((option) => ({
              name: option.name,
              color: (option.color ?? "gray") as ProjectFieldOptionColor,
              description: option.description ?? "",
            })),
          }
        : {}),
    };
  return {
    entity: entity.storage,
    name: entity.name,
    description: entity.description ?? "",
    ...(entity.storage !== "milestone"
      ? { color: entity.color ?? (entity.storage === "label" ? "ededed" : "gray") }
      : {}),
    ...(entity.storage === "issue-type" ? { enabled: true } : {}),
  };
}
function write(
  input: ScopeInput,
  owned: OwnedEntity,
  observed: ScopeEntity | undefined,
  properties: PlanChange["properties"],
): ScopeEntityWrite {
  const entity = desired(owned);
  if (owned.storage === "issue-field" && input.scope.kind === "organization" && "type" in entity) {
    return observed
      ? {
          kind: "issue-field-update",
          organization: input.scope.organization,
          nodeId: observed.nodeId,
          ...(properties.includes("name") ? { name: owned.name } : {}),
          ...(properties.includes("options") ? { options: entity.options } : {}),
        }
      : {
          kind: "issue-field-create",
          organization: input.scope.organization,
          name: owned.name,
          type: owned.type!,
          ...(entity.options ? { options: entity.options } : {}),
        };
  }
  if (owned.storage === "issue-type" && input.scope.kind === "organization" && "entity" in entity)
    return observed
      ? {
          kind: "issue-type-update",
          organization: input.scope.organization,
          nodeId: observed.nodeId,
          ...(properties.includes("name") ? { name: owned.name } : {}),
          ...(properties.includes("color")
            ? { color: entity.color as ProjectFieldOptionColor }
            : {}),
          ...(properties.includes("description") ? { description: entity.description } : {}),
          ...(properties.includes("enabled") ? { enabled: true } : {}),
        }
      : {
          kind: "issue-type-create",
          organization: input.scope.organization,
          name: entity.name,
          color: entity.color as ProjectFieldOptionColor,
          description: entity.description,
        };
  if (owned.storage === "label" && input.scope.kind === "repository" && "entity" in entity)
    return observed
      ? {
          kind: "label-update",
          repository: input.scope.repository,
          nodeId: observed.nodeId,
          ...(properties.includes("name") ? { name: entity.name } : {}),
          ...(properties.includes("color") ? { color: entity.color! } : {}),
          ...(properties.includes("description") ? { description: entity.description } : {}),
        }
      : {
          kind: "label-create",
          repository: input.scope.repository,
          name: entity.name,
          color: entity.color!,
          description: entity.description,
        };
  if (owned.storage === "milestone" && input.scope.kind === "repository" && "entity" in entity)
    return observed && "number" in observed
      ? {
          kind: "milestone-update",
          repository: input.scope.repository,
          number: observed.number,
          ...(properties.includes("name") ? { title: entity.name } : {}),
          ...(properties.includes("description") ? { description: entity.description } : {}),
        }
      : {
          kind: "milestone-create",
          repository: input.scope.repository,
          title: entity.name,
          description: entity.description,
        };
  throw new TypeError("Entity does not belong to its storage scope");
}
/** Shared entity matching and dispatch. Kind-specific adapters extend comparison at this seam. */
export function planScopeConfiguration(input: ScopeInput): ScopePlan {
  if (input.observed?.status !== "ready") return { changes: [], writes: [], applied: undefined };
  const changes: PlanChange[] = [];
  const writes: { write: ScopeEntityWrite; changes: readonly PlanChange[] }[] = [];
  const owned: Record<string, string> = {};
  const scope = {
    kind: input.scope.kind,
    name: input.scope.kind === "organization" ? input.scope.organization : input.scope.repository,
    bindings: input.bindings,
  };
  const order = ["issue-field", "issue-type", "label", "milestone"];
  for (const entity of [...input.owned.entities].sort(
    (a, b) => order.indexOf(a.storage) - order.indexOf(b.storage),
  )) {
    const candidates = entities(input, entity.storage);
    const id = input.applied?.owned[entity.key];
    const observed =
      candidates.find((candidate) => candidate.nodeId === id) ??
      candidates.find((candidate) =>
        entity.storage === "issue-type" || entity.storage === "label"
          ? nameOf(candidate).toLowerCase() === entity.name.toLowerCase()
          : nameOf(candidate) === entity.name,
      );
    if (observed) owned[entity.key] = observed.nodeId;
    const to = desired(entity);
    const from = observed ? target(observed, entity.storage) : null;
    const properties: ("name" | "color" | "description" | "enabled" | "options")[] = [];
    if (from && from.name !== to.name) properties.push("name");
    if (from && "entity" in to && "entity" in from) {
      if (entity.color !== undefined && from.color !== to.color) properties.push("color");
      if (entity.description !== undefined && from.description !== to.description)
        properties.push("description");
      if (to.entity === "issue-type" && !from.enabled) properties.push("enabled");
    }
    if (from && "type" in to && "type" in from && canonical(from.options) !== canonical(to.options))
      properties.push("options");
    if (from && !properties.length) continue;
    let before: ScopeEntity | undefined;
    if (input.applied?.configuration.status === "ready")
      before = entities({ ...input, observed: input.applied.configuration }, entity.storage).find(
        (candidate) => candidate.nodeId === id,
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
      description: `${observed ? "Change" : "Create"} ${entity.storage} ${entity.name}.`,
      action: observed ? "change" : "create",
      side: "github",
      drift: !!before && canonical(target(before, entity.storage)) !== canonical(from),
      requiresRemoval: false,
      properties,
      from,
      to,
    };
    changes.push(change);
    writes.push({ write: write(input, entity, observed, properties), changes: [change] });
  }
  return { changes, writes, applied: { configuration: input.observed, owned } };
}
