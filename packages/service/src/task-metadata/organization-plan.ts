// ---
// relationships:
//   implements: task-metadata
// ---
import { scopeKey } from "@wyrd-company/manifold-shared";
import type { OwnedEntity, TaskField } from "@wyrd-company/manifold-shared";
import { planProjectConfiguration, projectWrites } from "./plan.ts";
import type { ScopeInput, ScopePlan, PlanInput, PlanChange } from "./project-types.ts";
import type { IssueTypeConfiguration } from "../github-source/index.ts";

/** Issue fields use the same field/option identity rules as Project fields. */
export function organizationPlan(input: ScopeInput, remove = true): ScopePlan {
  if (input.scope.kind !== "organization" || input.observed?.status !== "ready")
    return { changes: [], writes: [], applied: undefined };
  const organization = input.scope.organization;
  const observed = input.observed;
  const before =
    input.applied?.configuration.status === "ready" ? input.applied.configuration : undefined;
  const changes: PlanChange[] = [];
  const writes: ScopePlan["writes"][number][] = [];
  const owned: Record<string, string> = {};
  const scope = { kind: "organization" as const, name: organization, bindings: input.bindings };
  const decorate = (entity: OwnedEntity, change: PlanChange): PlanChange => ({
    ...change,
    id: `${scopeKey(input.scope)}:${entity.key}:${change.id}`,
    storage: entity.storage,
    scope,
    target: { ...change.target, taskField: entity.declarations[0]!.field },
  });
  for (const entity of input.owned.entities.filter((e) => e.storage === "issue-field")) {
    const identity = input.applied?.owned[entity.key];
    const match =
      observed.issueFields.find((f) => f.nodeId === identity) ??
      observed.issueFields.find((f) => f.name === entity.name);
    if (match) owned[entity.key] = match.nodeId;
    const declaration: TaskField =
      entity.type === "single-select"
        ? {
            type: entity.type,
            whenChanged: entity.whenChanged,
            storage: { kind: "project-field", name: entity.name },
            options: entity.options!,
          }
        : {
            type: entity.type as "text" | "number" | "date",
            whenChanged: entity.whenChanged,
            storage: { kind: "project-field", name: entity.name },
          };
    const fieldInput: PlanInput = {
      metadata: { lifecycle: { field: "", options: [] }, fields: { field: declaration } },
      fields: match ? [match] : [],
      applied: input.applied
        ? {
            fields: before?.issueFields ?? [],
            owned: { lifecycle: undefined, fields: identity ? { field: identity } : {} },
          }
        : undefined,
    };
    const plan = planProjectConfiguration(fieldInput);
    const local = plan.changes.filter((c) => !c.target.lifecycle);
    changes.push(...local.map((c) => decorate(entity, c)));
    const fieldPlan = { ...plan, changes: local };
    for (const group of projectWrites(fieldInput, fieldPlan, "", remove)) {
      const w = group.write;
      const write =
        w.kind === "create"
          ? {
              kind: "issue-field-create" as const,
              organization,
              name: w.name,
              type: w.type,
              ...(w.options ? { options: w.options } : {}),
            }
          : w.kind === "delete"
            ? { kind: "issue-field-delete" as const, organization, nodeId: w.fieldNodeId }
            : {
                kind: "issue-field-update" as const,
                organization,
                nodeId: w.fieldNodeId,
                ...(w.name !== undefined ? { name: w.name } : {}),
                ...(w.options ? { options: w.options } : {}),
              };
      writes.push({ write, changes: group.changes.map((c) => decorate(entity, c)) });
    }
  }
  function target(type: IssueTypeConfiguration) {
    return {
      entity: "issue-type" as const,
      name: type.name,
      ...(type.color !== null ? { color: type.color } : {}),
      description: type.description,
      enabled: type.enabled,
    };
  }
  for (const entity of input.owned.entities.filter((e) => e.storage === "issue-type")) {
    const identity = input.applied?.owned[entity.key];
    const match =
      observed.issueTypes.find((t) => t.nodeId === identity) ??
      observed.issueTypes.find((t) => t.name.toLowerCase() === entity.name.toLowerCase());
    if (match) owned[entity.key] = match.nodeId;
    const previous = before?.issueTypes.find((t) => t.nodeId === identity);
    const desired = {
      entity: "issue-type" as const,
      name: entity.name,
      color: entity.color ?? match?.color ?? "gray",
      description: entity.description ?? match?.description ?? "",
      enabled: true,
    };
    const properties: ("name" | "color" | "description" | "enabled")[] = [];
    if (match && match.name !== entity.name) properties.push("name");
    if (match && entity.color !== undefined && match.color !== entity.color)
      properties.push("color");
    if (match && entity.description !== undefined && match.description !== entity.description)
      properties.push("description");
    if (match && !match.enabled) properties.push("enabled");
    if (match && !properties.length) continue;
    const drift =
      !!previous &&
      (!match || properties.some((property) => previous[property] !== match[property]));
    const accept =
      entity.whenChanged === "accept" &&
      drift &&
      (!match || (/^\S(?:.*\S)?$/.test(match.name) && match.enabled));
    const change: PlanChange = {
      id: `${scopeKey(input.scope)}:${entity.key}:${accept ? "declaration" : match ? "change" : "create"}`,
      storage: "issue-type",
      scope,
      target: { field: entity.name, lifecycle: false, taskField: entity.declarations[0]!.field },
      description: `${accept ? "Accept" : match ? "Change" : "Create"} issue-type ${entity.name}.`,
      action: accept && !match ? "remove" : match ? "change" : "create",
      side: accept ? "declaration" : "github",
      drift,
      requiresRemoval: false,
      properties,
      from: match ? target(match) : null,
      to: accept ? (match ? target(match) : null) : desired,
    };
    changes.push(change);
    if (!accept)
      writes.push({
        changes: [change],
        write: match
          ? {
              kind: "issue-type-update",
              organization,
              nodeId: match.nodeId,
              ...(properties.includes("name") ? { name: entity.name } : {}),
              ...(properties.includes("color")
                ? { color: desired.color as IssueTypeConfiguration["color"] & string }
                : {}),
              ...(properties.includes("description") ? { description: desired.description } : {}),
              ...(properties.includes("enabled") ? { enabled: true } : {}),
            }
          : {
              kind: "issue-type-create",
              organization,
              name: entity.name,
              color: desired.color as IssueTypeConfiguration["color"] & string,
              description: desired.description,
            },
      });
  }
  return { changes, writes, applied: { configuration: observed, owned } };
}

/** Shared owners may give one organization entity different task field names. */
export function organizationChangeOwnedBy(
  scopes: readonly ScopeInput[],
  change: PlanChange,
  taskField: string,
): boolean {
  return (
    change.scope?.kind === "organization" &&
    scopes.some(
      (scope) =>
        scope.scope.kind === "organization" &&
        scope.scope.organization === change.scope!.name &&
        scope.owned.entities.some(
          (entity) =>
            entity.storage === change.storage &&
            entity.name === change.target.field &&
            entity.declarations.some((declaration) => declaration.field === taskField),
        ),
    )
  );
}
