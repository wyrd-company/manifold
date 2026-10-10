// ---
// relationships:
//   implements: task-metadata-declaration
// ---
import type {
  TaskField,
  TaskFieldOption,
  TaskMetadataDeclaration,
  TaskMetadataFinding,
} from "./task-metadata-declaration.ts";
export type StorageScope =
  | { readonly kind: "organization"; readonly organization: string }
  | { readonly kind: "repository"; readonly repository: string };
export interface OwnedEntity {
  readonly key: string;
  readonly storage: "issue-field" | "issue-type" | "label" | "milestone";
  readonly name: string;
  readonly type?: TaskField["type"];
  readonly color?: string | undefined;
  readonly description?: string | undefined;
  readonly options?: readonly TaskFieldOption[];
  readonly labelPrefixes?: readonly string[];
  readonly whenChanged: "revert" | "accept";
  readonly declarations: readonly { binding: string; field: string }[];
}
export interface ScopeOwnership {
  readonly scope: StorageScope;
  readonly entities: readonly OwnedEntity[];
  readonly prefixes: readonly string[];
  readonly bindings: readonly string[];
}
export function scopeKey(scope: StorageScope): string {
  return scope.kind === "organization"
    ? `organization:${scope.organization.toLowerCase()}`
    : `repository:${scope.repository.toLowerCase()}`;
}
export function repositoryInScope(entries: readonly string[], repository: string): boolean {
  const lower = repository.toLowerCase();
  return entries.some(
    (entry) =>
      entry.toLowerCase() === lower ||
      (entry.endsWith("/*") &&
        entry.slice(0, -1).toLowerCase() === lower.slice(0, lower.indexOf("/") + 1)),
  );
}
function entities(binding: string, name: string, field: TaskField): OwnedEntity[] {
  const storage = field.storage;
  const base = { whenChanged: field.whenChanged, declarations: [{ binding, field: name }] };
  if (storage.kind === "issue-field")
    return [
      {
        ...base,
        key: `issue-field:${storage.name}`,
        storage: storage.kind,
        name: storage.name,
        type: field.type,
        ...(field.type === "single-select" ? { options: field.options } : {}),
      },
    ];
  if (
    field.type !== "single-select" ||
    storage.kind === "project-field" ||
    storage.kind === "front-matter"
  )
    return [];
  return field.options.map((option) => {
    const entityName = storage.kind === "label" ? storage.prefix + option.name : option.name;
    return {
      ...base,
      ...(storage.kind === "label" ? { labelPrefixes: [storage.prefix] } : {}),
      ...option,
      name: entityName,
      storage: storage.kind,
      key: `${storage.kind}:${storage.kind === "milestone" ? entityName : entityName.toLowerCase()}`,
    };
  });
}
export function scopeOwnership(
  declaration: TaskMetadataDeclaration,
  owners: Readonly<Record<string, string>>,
  repositoriesOf: (binding: string) => readonly string[],
): ReadonlyMap<string, ScopeOwnership> {
  const scopes = new Map<string, ScopeOwnership>();
  for (const [binding, project] of Object.entries(declaration.projects))
    for (const [name, field] of Object.entries(project.fields)) {
      const storage = field.storage;
      const reached: StorageScope[] =
        storage.kind === "issue-field" || storage.kind === "issue-type"
          ? [{ kind: "organization", organization: storage.organization || owners[binding] || "" }]
          : storage.kind === "label" || storage.kind === "milestone"
            ? [
                ...new Set(
                  (project.repositories ?? [])
                    .flatMap((entry) =>
                      entry.endsWith("/*")
                        ? repositoriesOf(binding).filter((repository) =>
                            repositoryInScope([entry], repository),
                          )
                        : [entry],
                    )
                    .map((repository) => repository.toLowerCase()),
                ),
              ].map((repository) => ({ kind: "repository", repository }))
            : [];
      for (const scope of reached) {
        const key = scopeKey(scope);
        const old = scopes.get(key) ?? { scope, entities: [], prefixes: [], bindings: [] };
        const merged = [...old.entities];
        for (const entity of entities(binding, name, field)) {
          const index = merged.findIndex((old) => old.key === entity.key);
          if (index < 0) {
            merged.push(entity);
            continue;
          }
          const earlier = merged[index]!;
          const options = earlier.options?.map((option, index) => ({
            ...option,
            ...entity.options?.[index],
          }));
          merged[index] = {
            ...earlier,
            ...entity,
            ...(options ? { options } : {}),
            declarations: [...earlier.declarations, ...entity.declarations],
            ...(entity.labelPrefixes
              ? { labelPrefixes: [...(earlier.labelPrefixes ?? []), ...entity.labelPrefixes] }
              : {}),
            color: entity.color ?? earlier.color,
            description: entity.description ?? earlier.description,
          };
        }
        scopes.set(key, {
          scope,
          entities: merged,
          prefixes: [
            ...new Set([
              ...old.prefixes,
              ...(storage.kind === "label" && storage.prefix ? [storage.prefix] : []),
            ]),
          ].sort(),
          bindings: [...new Set([...old.bindings, binding])],
        });
      }
    }
  return scopes;
}
export function sharedConflicts(declaration: TaskMetadataDeclaration): TaskMetadataFinding[] {
  const findings: TaskMetadataFinding[] = [];
  const seen: { scope: StorageScope; entity: OwnedEntity }[] = [];
  const pointer = (name: string) => name.replaceAll("~", "~0").replaceAll("/", "~1");
  for (const [binding, project] of Object.entries(declaration.projects))
    for (const [name, field] of Object.entries(project.fields)) {
      const storage = field.storage;
      const scopes: StorageScope[] =
        storage.kind === "issue-field" || storage.kind === "issue-type"
          ? [{ kind: "organization", organization: storage.organization }]
          : storage.kind === "label" || storage.kind === "milestone"
            ? (project.repositories ?? []).map((repository) => ({
                kind: "repository",
                repository: repository.toLowerCase(),
              }))
            : [];
      for (const scope of scopes)
        for (const entity of entities(binding, name, field)) {
          const at = `/projects/${pointer(binding)}/fields/${pointer(name)}`;
          for (const previous of seen) {
            const overlaps =
              scopeKey(scope) === scopeKey(previous.scope) ||
              (scope.kind === "repository" &&
                previous.scope.kind === "repository" &&
                (repositoryInScope([scope.repository], previous.scope.repository) ||
                  repositoryInScope([previous.scope.repository], scope.repository)));
            if (
              !overlaps ||
              previous.entity.key !== entity.key ||
              previous.entity.declarations[0]!.binding === binding
            )
              continue;
            const old = previous.entity;
            let location: string | undefined;
            let difference: string | undefined;
            if (
              old.whenChanged !== entity.whenChanged ||
              old.type !== entity.type ||
              JSON.stringify(old.options?.map((option) => option.name)) !==
                JSON.stringify(entity.options?.map((option) => option.name))
            ) {
              location = at;
              difference =
                old.whenChanged !== entity.whenChanged
                  ? "whenChanged differs"
                  : old.type !== entity.type
                    ? "type differs"
                    : "option names or order differ";
            } else if (entity.options)
              for (const [index, option] of entity.options.entries())
                for (const property of ["color", "description"] as const) {
                  if (
                    option[property] !== undefined &&
                    old.options?.[index]?.[property] !== undefined &&
                    option[property] !== old.options[index]![property]
                  ) {
                    location = `${at}/options/${index}/${property}`;
                    difference = `${property} differs`;
                  }
                }
            else
              for (const property of ["color", "description"] as const)
                if (
                  entity[property] !== undefined &&
                  old[property] !== undefined &&
                  entity[property] !== old[property]
                ) {
                  const index =
                    field.type === "single-select"
                      ? field.options.findIndex(
                          (option) =>
                            (storage.kind === "label"
                              ? storage.prefix + option.name
                              : option.name
                            ).toLowerCase() === entity.name.toLowerCase(),
                        )
                      : 0;
                  location = `${at}/options/${index}/${property}`;
                  difference = `${property} differs`;
                }
            if (location && !findings.some((finding) => finding.location === location))
              findings.push({
                kind: "shared-conflict",
                location,
                message: `${difference} from ${old.declarations[0]!.binding}.${old.declarations[0]!.field} for ${entity.key} in ${scopeKey(scope)}`,
              });
          }
          seen.push({ scope, entity });
        }
    }
  return findings;
}
