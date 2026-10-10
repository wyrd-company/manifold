// ---
// relationships:
//   implements: task-metadata-declaration
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { parseDocument } from "yaml";
import { serviceConfigurationSchemas } from "./service-configuration-schemas.ts";
import { bindingsDeclarationSchema } from "./portfolio-declaration-schema.ts";
import type { BindingsDocument } from "./portfolio-declaration-types.ts";
import { sharedConflicts } from "./task-metadata-scopes.ts";
import { taskMetadataDeclarationSchema } from "./task-metadata-schema.ts";
export type OptionColor =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "pink"
  | "purple";
export type TaskFieldType = "text" | "number" | "date" | "single-select";
export type TaskFieldStorage =
  | { readonly kind: "project-field"; readonly name: string }
  | { readonly kind: "issue-field"; readonly name: string; readonly organization: string }
  | { readonly kind: "issue-type"; readonly organization: string }
  | { readonly kind: "label"; readonly prefix: string }
  | { readonly kind: "milestone" }
  | { readonly kind: "front-matter"; readonly key: string };
export type TaskFieldValue =
  | { readonly state: "set"; readonly value: string | number }
  | { readonly state: "empty" }
  | { readonly state: "invalid" | "unavailable"; readonly detail: string };
export interface TaskFieldStorageKind {
  readonly kind: TaskFieldStorage["kind"];
  readonly types: readonly TaskFieldType[];
  readonly settings: readonly string[];
  readonly optionProperties: readonly ("color" | "description")[];
  readonly color?: "named" | "hex";
  readonly scope: "project" | "organization" | "repository" | "issue";
}
export interface TaskFieldOption {
  readonly name: string;
  readonly color?: string;
  readonly description?: string;
}
export type TaskField =
  | {
      readonly type: "text" | "number" | "date";
      readonly storage: TaskFieldStorage;
      readonly whenChanged: "revert" | "accept";
    }
  | {
      readonly type: "single-select";
      readonly storage: TaskFieldStorage;
      readonly options: readonly TaskFieldOption[];
      readonly whenChanged: "revert" | "accept";
    };
export interface LifecycleField {
  readonly field: string;
  readonly options: readonly string[];
}
export interface ProjectMetadata {
  readonly lifecycle: LifecycleField;
  readonly repositories?: readonly string[];
  /** Keyed by task field name, in document order; empty when the document has no `fields`. */
  readonly fields: Readonly<Record<string, TaskField>>;
}
export type TaskMetadataDeclaration = {
  /** Keyed by GitHub Project binding name. */
  readonly projects: Readonly<Record<string, ProjectMetadata>>;
};
/** The storage kinds table: offered to the console from one source. */
export const taskFieldStorageKinds: readonly TaskFieldStorageKind[] = [
  {
    kind: "project-field",
    types: ["text", "number", "date", "single-select"],
    settings: ["name"],
    optionProperties: ["color", "description"],
    color: "named",
    scope: "project",
  },
  {
    kind: "issue-field",
    types: ["text", "number", "date", "single-select"],
    settings: ["name", "organization"],
    optionProperties: ["color", "description"],
    color: "named",
    scope: "organization",
  },
  {
    kind: "issue-type",
    types: ["single-select"],
    settings: ["organization"],
    optionProperties: ["color", "description"],
    color: "named",
    scope: "organization",
  },
  {
    kind: "label",
    types: ["single-select"],
    settings: ["prefix"],
    optionProperties: ["color", "description"],
    color: "hex",
    scope: "repository",
  },
  {
    kind: "milestone",
    types: ["single-select"],
    settings: [],
    optionProperties: ["description"],
    scope: "repository",
  },
  {
    kind: "front-matter",
    types: ["text", "number", "date", "single-select"],
    settings: ["key"],
    optionProperties: [],
    scope: "issue",
  },
];
export type TaskMetadataFinding = {
  readonly kind:
    | "syntax"
    | "schema"
    | "unknown-binding"
    | "duplicate-field"
    | "duplicate-option"
    | "storage-mismatch"
    | "storage-scope"
    | "shared-conflict";
  readonly location: string;
  readonly message: string;
};
export type TaskMetadataLint =
  | { readonly ok: true; readonly declaration: TaskMetadataDeclaration }
  | { readonly ok: false; readonly findings: readonly TaskMetadataFinding[] };
/** The validated document before defaults are applied. */
type RawOption =
  | string
  | { readonly name: string; readonly color?: string; readonly description?: string };
type RawField = {
  readonly type: TaskFieldType;
  readonly whenChanged?: "revert" | "accept";
  readonly storage?: {
    readonly kind: TaskFieldStorage["kind"];
    readonly name?: string;
    readonly organization?: string;
    readonly key?: string;
    readonly prefix?: string;
  };
  readonly options?: readonly RawOption[];
};
type RawProject = {
  readonly lifecycle: LifecycleField;
  readonly repositories?: readonly string[];
  readonly fields?: Readonly<Record<string, RawField>>;
};
type RawDocument = { readonly projects?: Readonly<Record<string, RawProject>> };
let validators:
  | {
      metadata: ValidateFunction<RawDocument>;
      bindings: ValidateFunction<BindingsDocument>;
    }
  | undefined;
function declarationValidators() {
  if (!validators) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
    ajv.addSchema(taskMetadataDeclarationSchema);
    validators = {
      metadata: ajv.compile({ $ref: `${taskMetadataDeclarationSchema.$id}#/$defs/declaration` }),
      bindings: ajv.compile(bindingsDeclarationSchema),
    };
  }
  return validators;
}
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
function json(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Object.values(value).every((child) => json(child, ancestors));
  ancestors.delete(value);
  return valid;
}
function read<T>(
  text: string | undefined,
  validator: ValidateFunction<T>,
  findings: TaskMetadataFinding[],
  prefix = "",
): T | undefined {
  let value: unknown;
  try {
    const document = parseDocument(text ?? "", {
      version: "1.2",
      schema: "core",
      uniqueKeys: true,
      customTags: [],
    });
    if (document.errors.length || document.warnings.length)
      throw new Error((document.errors[0] ?? document.warnings[0])!.message);
    if (document.directives?.yaml.version !== "1.2")
      throw new Error("Declaration must use YAML 1.2");
    value = document.toJS() ?? {};
  } catch (error) {
    findings.push({
      kind: "syntax",
      location: "",
      message: `${prefix}${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }
  if (!json(value)) {
    findings.push({
      kind: "schema",
      location: "",
      message: `${prefix}Document must round-trip through JSON unchanged`,
    });
    return;
  }
  if (validator(value)) return value;
  const locations = new Set<string>();
  for (const error of validator.errors ?? []) {
    const property =
      error.propertyName ?? error.params["missingProperty"] ?? error.params["additionalProperty"];
    const location =
      error.instancePath + (typeof property === "string" ? `/${pointer(property)}` : "");
    if (locations.has(location)) continue;
    locations.add(location);
    findings.push({
      kind: "schema",
      location,
      message: `${prefix}${error.message ?? "Invalid declaration"}`,
    });
  }
}
function buildOption(raw: RawOption): TaskFieldOption {
  if (typeof raw === "string") return { name: raw };
  const option: { name: string; color?: string; description?: string } = { name: raw.name };
  if ("color" in raw && raw.color !== undefined) option.color = raw.color;
  if ("description" in raw && raw.description !== undefined) option.description = raw.description;
  return option;
}
function buildField(name: string, raw: RawField, owner: string): TaskField {
  const kind = raw.storage?.kind ?? "project-field";
  const organization = (raw.storage?.organization ?? owner).toLowerCase();
  const storage: TaskFieldStorage =
    kind === "project-field"
      ? { kind, name: raw.storage?.name ?? name }
      : kind === "issue-field"
        ? { kind, name: raw.storage?.name ?? name, organization }
        : kind === "issue-type"
          ? { kind, organization }
          : kind === "label"
            ? { kind, prefix: raw.storage?.prefix ?? "" }
            : kind === "front-matter"
              ? { kind, key: raw.storage?.key ?? name }
              : { kind };
  const whenChanged = raw.whenChanged ?? "revert";
  if (raw.type === "single-select")
    return {
      type: "single-select",
      storage,
      whenChanged,
      options: (raw.options ?? []).map(buildOption),
    };
  return { type: raw.type, storage, whenChanged };
}
export function lintTaskMetadataDeclaration(files: {
  readonly taskMetadata: string | undefined;
  readonly bindings: string | undefined;
}): TaskMetadataLint {
  const findings: TaskMetadataFinding[] = [];
  const validate = declarationValidators();
  const metadata = read(files.taskMetadata, validate.metadata, findings);
  if (!metadata) return { ok: false, findings };
  const bindings = read(files.bindings, validate.bindings, []);
  const projects: Record<string, ProjectMetadata> = {};
  for (const [name, rawProject] of Object.entries(metadata.projects ?? {})) {
    const at = `/projects/${pointer(name)}`;
    if (bindings && !Object.hasOwn(bindings.githubProjects ?? {}, name))
      findings.push({
        kind: "unknown-binding",
        location: at,
        message: `GitHub Project binding is not declared: ${name}`,
      });
    const fields: Record<string, TaskField> = {};
    const occupied = new Set<string>([`project-field:${rawProject.lifecycle.field}`]);
    for (const [fieldName, rawField] of Object.entries(rawProject.fields ?? {})) {
      const field = buildField(fieldName, rawField, bindings?.githubProjects?.[name]?.owner ?? "");
      const fieldAt = `${at}/fields/${pointer(fieldName)}`;
      const places = fieldPlaces(field);
      if (fieldName === rawProject.lifecycle.field || places.some((place) => occupied.has(place)))
        findings.push({
          kind: "duplicate-field",
          location: fieldAt,
          message: "Task fields share a storage place",
        });
      places.forEach((place) => occupied.add(place));
      const kind = taskFieldStorageKinds.find((kind) => kind.kind === field.storage.kind)!;
      if (!kind.types.includes(field.type))
        findings.push({
          kind: "storage-mismatch",
          location: `${fieldAt}/type`,
          message: "Storage cannot hold this type",
        });
      if (field.type === "single-select")
        field.options.forEach((option, index) => {
          for (const property of ["color", "description"] as const) {
            const value = option[property];
            if (value === undefined) continue;
            if (
              !kind.optionProperties.includes(property) ||
              (property === "color" &&
                !(kind.color === "hex"
                  ? /^[0-9a-f]{6}$/.test(value)
                  : /^(gray|blue|green|yellow|orange|red|pink|purple)$/.test(value))) ||
              (field.storage.kind === "label" && property === "description" && value.length > 100)
            )
              findings.push({
                kind: "storage-mismatch",
                location: `${fieldAt}/options/${index}/${property}`,
                message: "Property is not supported by storage",
              });
          }
        });
      if (kind.scope === "repository" && !rawProject.repositories?.length)
        findings.push({
          kind: "storage-scope",
          location: `${fieldAt}/storage`,
          message: "Repository storage requires repositories",
        });
      if (field.storage.kind === "front-matter" && rawField.whenChanged !== undefined)
        findings.push({
          kind: "storage-mismatch",
          location: `${fieldAt}/whenChanged`,
          message: "Front matter has no configuration",
        });
      if (field.type === "single-select") {
        const seen = new Set<string>();
        field.options.forEach((option, index) => {
          if (
            seen.has(
              field.storage.kind === "label" || field.storage.kind === "issue-type"
                ? option.name.toLowerCase()
                : option.name,
            )
          )
            findings.push({
              kind: "duplicate-option",
              location: `${fieldAt}/options/${index}`,
              message: `Option name is declared twice: ${option.name}`,
            });
          else
            seen.add(
              field.storage.kind === "label" || field.storage.kind === "issue-type"
                ? option.name.toLowerCase()
                : option.name,
            );
        });
      }
      fields[fieldName] = field;
    }
    projects[name] = {
      lifecycle: rawProject.lifecycle,
      repositories: rawProject.repositories ?? [],
      fields,
    };
  }
  findings.push(...sharedConflicts({ projects }));
  return findings.length ? { ok: false, findings } : { ok: true, declaration: { projects } };
}
export function declaredLifecycleOptions(
  declaration: TaskMetadataDeclaration,
): ReadonlySet<string> {
  return new Set(
    Object.values(declaration.projects)
      .flatMap((project) => [...project.lifecycle.options])
      .sort(),
  );
}

function fieldPlaces(field: TaskField): string[] {
  const storage = field.storage;
  if (storage.kind === "project-field") return [`project-field:${storage.name}`];
  if (storage.kind === "issue-field")
    return [`issue-field:${storage.organization}:${storage.name}`];
  if (storage.kind === "issue-type") return [`issue-type:${storage.organization}`];
  if (storage.kind === "front-matter") return [`front-matter:${storage.key}`];
  if (storage.kind === "label")
    return field.type === "single-select"
      ? field.options.map((option) => `label:${(storage.prefix + option.name).toLowerCase()}`)
      : [];
  return ["milestone"];
}
export function declaredTaskFields(declaration: TaskMetadataDeclaration) {
  const fields = new Map<string, { types: Set<TaskFieldType>; options: Set<string> }>();
  for (const project of Object.values(declaration.projects))
    for (const [name, field] of Object.entries(project.fields)) {
      const entry = fields.get(name) ?? {
        types: new Set<TaskFieldType>(),
        options: new Set<string>(),
      };
      entry.types.add(field.type);
      if (field.type === "single-select")
        field.options.forEach((option) => entry.options.add(option.name));
      fields.set(name, entry);
    }
  return fields;
}
