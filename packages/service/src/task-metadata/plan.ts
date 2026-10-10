// ---
// relationships:
//   implements: task-metadata
// ---
import { organizationChangeOwnedBy } from "./organization-plan.ts";
import { planScopeConfiguration } from "./scope-plan.ts";
import { pendingRepositoryScopes } from "./repository-state.ts";
import { createHash } from "node:crypto";
import type { ProjectMetadata } from "@wyrd-company/manifold-shared";
import type {
  ProjectField,
  ProjectFieldOption,
  ProjectFieldWrite,
} from "../github-source/index.ts";
import type {
  AppliedConfiguration,
  FieldTarget,
  PlanChange,
  PlanInput,
  ProjectPlan,
} from "./project-types.ts";
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
type OwnedField = {
  field: string;
  lifecycle: boolean;
  taskField?: string;
  type: "text" | "number" | "date" | "single-select";
  options: readonly { name: string; color?: ProjectFieldOption["color"]; description?: string }[];
  accept: boolean;
};
export function ownedFields(metadata: ProjectMetadata | undefined): OwnedField[] {
  if (!metadata) return [];
  return [
    {
      field: metadata.lifecycle.field,
      lifecycle: true,
      type: "single-select",
      options: metadata.lifecycle.options.map((name) => ({ name })),
      accept: false,
    },
    ...Object.entries(metadata.fields ?? {})
      .filter(([, f]) => f.storage.kind === "project-field")
      .map(([taskField, f]) => ({
        field: f.storage.kind === "project-field" ? f.storage.name : taskField,
        lifecycle: false,
        taskField,
        type: f.type,
        options: ("options" in f ? f.options : []).map((o) =>
          typeof o === "string"
            ? { name: o }
            : { ...o, color: o.color as ProjectFieldOption["color"] },
        ),
        accept: f.whenChanged === "accept",
      })),
  ];
}
export function matchFields(input: PlanInput) {
  const used = new Set<string>();
  return ownedFields(input.metadata).map((owned) => {
    const id = owned.lifecycle
      ? input.applied?.owned.lifecycle
      : input.applied?.owned.fields[owned.taskField!];
    const before = input.applied?.fields.find((f) => f.nodeId === id);
    const observed =
      input.fields.find((f) => f.nodeId === id && !used.has(f.nodeId)) ??
      input.fields.find((f) => f.name === owned.field && !used.has(f.nodeId));
    if (observed) used.add(observed.nodeId);
    return { owned, before, observed };
  });
}
function targetField(f: ProjectField): FieldTarget {
  return {
    name: f.name,
    type: f.type,
    ...(f.type === "single-select" ? { options: f.options.map(targetOption) } : {}),
  };
}
function targetOption(o: ProjectFieldOption) {
  return { name: o.name, color: o.color, description: o.description };
}
function desiredField(f: OwnedField): FieldTarget {
  return {
    name: f.field,
    type: f.type,
    ...(f.type === "single-select"
      ? {
          options: f.options.map((o) => ({
            name: o.name,
            color: o.color ?? "gray",
            description: o.description ?? "",
          })),
        }
      : {}),
  };
}
function optionsMatch(owned: OwnedField, observed: ProjectField, before: ProjectField | undefined) {
  const used = new Set<string>();
  return owned.options.map((wanted) => {
    const old = before?.options.find((o) => o.name === wanted.name);
    const current =
      observed.options.find((o) => o.id === old?.id && !used.has(o.id)) ??
      observed.options.find((o) => o.name === wanted.name && !used.has(o.id));
    if (current) used.add(current.id);
    return { wanted, old, current };
  });
}
export function planProjectConfiguration(input: PlanInput): ProjectPlan {
  const changes: PlanChange[] = [];
  const matches = matchFields(input);
  const matchedIds = new Set(matches.flatMap((m) => (m.observed ? [m.observed.nodeId] : [])));
  const statuses: ProjectPlan["fields"][number][] = [];
  for (const { owned, before, observed } of matches) {
    let local: PlanChange[] = [];
    const target = {
      field: owned.field,
      lifecycle: owned.lifecycle,
      ...(owned.taskField ? { taskField: owned.taskField } : {}),
    };
    function add(
      action: PlanChange["action"],
      properties: PlanChange["properties"],
      from: PlanChange["from"],
      to: PlanChange["to"],
      drift: boolean,
      requiresRemoval = false,
      option?: string,
    ) {
      local.push({
        id: `${action}:${owned.field}${option === undefined ? "" : `:${option}`}`,
        storage: "project-field",
        target: { ...target, ...(option === undefined ? {} : { option }) },
        description: `${action === "create" ? "Create" : action === "remove" ? "Remove" : "Change"} ${option === undefined ? `field ${owned.field}` : `option ${option} of field ${owned.field}`}.`,
        action,
        side: "github",
        drift: input.applied !== undefined && drift,
        requiresRemoval,
        properties,
        from,
        to,
      });
    }
    if (!observed) add("create", [], null, desiredField(owned), !!before);
    else if (observed.type !== owned.type) {
      const drift = !before || observed.nodeId !== before.nodeId || observed.type !== before.type;
      add("remove", [], targetField(observed), null, drift, true);
      add("create", [], null, desiredField(owned), drift, true);
    } else {
      if (observed.name !== owned.field)
        add(
          "change",
          ["name"],
          targetField(observed),
          { ...targetField(observed), name: owned.field },
          observed.name !== before?.name,
          input.fields.some((f) => !matchedIds.has(f.nodeId) && f.name === owned.field),
        );
      if (owned.type === "single-select") {
        const optionMatches = optionsMatch(owned, observed, before);
        const used = new Set(optionMatches.flatMap((m) => (m.current ? [m.current.id] : [])));
        for (const { wanted, old, current } of optionMatches) {
          const to = {
            name: wanted.name,
            color: wanted.color ?? current?.color ?? "gray",
            description: wanted.description ?? current?.description ?? "",
          };
          if (!current) add("create", [], null, to, !!old, false, wanted.name);
          else {
            const properties = (["name", "color", "description"] as const).filter(
              (p) => (p === "name" || wanted[p] !== undefined) && current[p] !== to[p],
            );
            if (properties.length)
              add(
                "change",
                properties,
                targetOption(current),
                to,
                properties.some((p) => current[p] !== old?.[p]),
                false,
                wanted.name,
              );
          }
        }
        for (const option of observed.options)
          if (!used.has(option.id))
            add(
              "remove",
              [],
              targetOption(option),
              null,
              !before?.options.some((o) => o.id === option.id),
              true,
              option.name,
            );
        const order = observed.options.filter((o) => used.has(o.id)).map((o) => o.id);
        const desiredOrder = optionMatches.flatMap((m) => (m.current ? [m.current.id] : []));
        if (canonical(order) !== canonical(desiredOrder))
          add(
            "change",
            ["order"],
            targetField(observed),
            desiredField(owned),
            canonical(order) !==
              canonical(before?.options.filter((o) => used.has(o.id)).map((o) => o.id)),
          );
      }
    }
    if (owned.accept && local.some((c) => c.drift) && representable(observed, owned, matches)) {
      local = [
        {
          id: `${observed ? "change" : "remove"}:${owned.field}:declaration`,
          storage: "project-field",
          target,
          description: `Accept GitHub's configuration of field ${owned.field}.`,
          action: observed ? "change" : "remove",
          side: "declaration",
          drift: true,
          requiresRemoval: false,
          properties: [],
          from: desiredField(owned),
          to: observed ? targetField(observed) : null,
        },
      ];
    }
    statuses.push({
      ...target,
      github: observed ? (local.length ? "differs" : "present") : "missing",
      detail: local[0]?.description ?? `Field ${owned.field} holds its declaration.`,
    });
    changes.push(...local);
  }
  if (input.metadata)
    for (const field of input.fields)
      if (!matchedIds.has(field.nodeId))
        changes.push({
          id: `remove:${field.name}`,
          storage: "project-field",
          target: { field: field.name, lifecycle: false },
          description: `Remove undeclared field ${field.name}.`,
          action: "remove",
          side: "github",
          drift: !!input.applied && !input.applied.fields.some((f) => f.nodeId === field.nodeId),
          requiresRemoval: true,
          properties: [],
          from: targetField(field),
          to: null,
        });
  const rank = (c: PlanChange) =>
    c.side === "declaration"
      ? 3
      : c.target.option === undefined && c.action === "remove"
        ? 0
        : c.target.option === undefined && c.action === "create"
          ? 1
          : 2;
  changes.sort((a, b) => rank(a) - rank(b));
  for (const [taskField, field] of Object.entries(input.metadata?.fields ?? {})) {
    if (field.storage.kind === "project-field") continue;
    const reached = (input.scopes ?? []).filter((scope) =>
      scope.owned.entities.some(
        (entity) =>
          entity.storage === field.storage.kind &&
          entity.declarations.some((declaration) => declaration.field === taskField),
      ),
    );
    const local = reached
      .flatMap((scope) => planScopeConfiguration(scope).changes)
      .filter(
        (change) =>
          change.target.taskField === taskField ||
          organizationChangeOwnedBy(reached, change, taskField),
      );
    const ready =
      reached.length > 0 && reached.every((scope) => scope.observed?.status === "ready");
    statuses.push({
      field:
        field.storage.kind === "front-matter"
          ? field.storage.key
          : field.storage.kind === "issue-field"
            ? field.storage.name
            : taskField,
      taskField,
      lifecycle: false,
      storage: field.storage.kind,
      github:
        field.storage.kind === "front-matter"
          ? "present"
          : !ready || local.some((change) => change.action === "create")
            ? "missing"
            : local.length
              ? "differs"
              : "present",
      detail:
        field.storage.kind === "front-matter"
          ? "Front matter is read and written on each issue; Apply changes no GitHub configuration."
          : (local[0]?.description ??
            (ready
              ? `Configuration belongs to ${reached.map((scope) => (scope.scope.kind === "organization" ? scope.scope.organization : scope.scope.repository)).join(", ")}.`
              : "The shared storage scope has no ready observation.")),
    });
  }
  const scopes = (input.scopes ?? []).map((scope) => ({
    scope: {
      kind: scope.scope.kind,
      name: scope.scope.kind === "organization" ? scope.scope.organization : scope.scope.repository,
      bindings: scope.bindings,
    },
    status: scope.observed?.status ?? ("unobserved" as const),
    observedAt: scope.observed?.readAt ?? null,
    ...(scope.observed && scope.observed.status !== "ready"
      ? { message: scope.observed.message }
      : {}),
  }));
  changes.push(...(input.scopes ?? []).flatMap((scope) => planScopeConfiguration(scope).changes));
  const drift = changes.filter((c) => c.drift).length;
  const pending = Math.max(
    changes.filter((c) => c.action !== "remove").length,
    pendingRepositoryScopes(input),
  );
  return {
    changes,
    scopes,
    outside: input.outside ?? [],
    fields: statuses,
    digest: createHash("sha256").update(canonical(changes)).digest("hex"),
    configuration:
      !input.metadata || !input.applied
        ? { state: "not-applied" }
        : drift
          ? { state: "drift", count: drift }
          : pending
            ? { state: "pending", count: pending }
            : { state: "in-sync" },
  };
}
function representable(
  observed: ProjectField | undefined,
  owned: OwnedField,
  matches: ReturnType<typeof matchFields>,
) {
  if (!observed) return true;
  const name = (s: string) => /^\S(?:.*\S)?$/.test(s);
  return (
    ["text", "number", "date", "single-select"].includes(observed.type) &&
    name(observed.name) &&
    (observed.type !== "single-select" || observed.options.length > 0) &&
    observed.options.every((o) => name(o.name)) &&
    new Set(observed.options.map((o) => o.name)).size === observed.options.length &&
    !matches.some((m) => m.owned !== owned && m.owned.field === observed.name)
  );
}
export function appliedConfiguration(
  metadata: ProjectMetadata,
  fields: readonly ProjectField[],
  previous: AppliedConfiguration | undefined,
): AppliedConfiguration {
  const matches = matchFields({ metadata, fields, applied: previous });
  return {
    fields,
    owned: {
      lifecycle: matches.find((m) => m.owned.lifecycle)?.observed?.nodeId,
      fields: Object.fromEntries(
        matches.flatMap((m) =>
          m.owned.taskField && m.observed ? [[m.owned.taskField, m.observed.nodeId]] : [],
        ),
      ),
    },
  };
}
export function projectWrites(
  input: PlanInput,
  plan: ProjectPlan,
  projectNodeId: string,
  remove: boolean,
): { write: ProjectFieldWrite; changes: readonly PlanChange[] }[] {
  const eligible = plan.changes.filter(
    (c) => c.storage === "project-field" && c.side === "github" && (!c.requiresRemoval || remove),
  );
  const result: { write: ProjectFieldWrite; changes: readonly PlanChange[] }[] = [];
  const matches = matchFields(input);
  for (const c of eligible.filter((c) => c.action === "remove" && c.target.option === undefined)) {
    const field = input.fields.find(
      (f) => f.name === c.from?.name && "type" in c.from && f.type === c.from.type,
    )!;
    result.push({
      write: { kind: "delete", projectNodeId, fieldNodeId: field.nodeId },
      changes: [c],
    });
  }
  for (const m of matches) {
    const local = eligible.filter((c) => c.target.field === m.owned.field);
    const create = local.find((c) => c.action === "create" && c.target.option === undefined);
    if (create) {
      const desired = desiredField(m.owned);
      result.push({
        write: {
          kind: "create",
          projectNodeId,
          name: desired.name,
          type: m.owned.type,
          ...(desired.options ? { options: desired.options } : {}),
        },
        changes: [create],
      });
      continue;
    }
    const updates = local.filter((c) => c.action !== "remove" || c.target.option !== undefined);
    if (!updates.length || !m.observed) continue;
    const options = optionsMatch(m.owned, m.observed, m.before);
    const used = new Set(options.flatMap((o) => (o.current ? [o.current.id] : [])));
    result.push({
      write: {
        kind: "update",
        projectNodeId,
        fieldNodeId: m.observed.nodeId,
        ...(updates.some((c) => c.properties.includes("name") && c.target.option === undefined)
          ? { name: m.owned.field }
          : {}),
        ...(updates.some((c) => c.target.option !== undefined || c.properties.includes("order"))
          ? {
              options: [
                ...options.map(({ wanted, current }) => ({
                  ...(current ? { id: current.id } : {}),
                  name: wanted.name,
                  color: wanted.color ?? current?.color ?? "gray",
                  description: wanted.description ?? current?.description ?? "",
                })),
                ...(!remove ? m.observed.options.filter((o) => !used.has(o.id)) : []),
              ],
            }
          : {}),
      },
      changes: updates,
    });
  }
  return result;
}
