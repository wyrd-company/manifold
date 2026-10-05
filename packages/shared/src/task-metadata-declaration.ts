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
import { taskMetadataDeclarationSchema } from "./task-metadata-schema.ts";
export type TaskMetadataDeclaration = {
  readonly projects: Readonly<
    Record<
      string,
      { readonly lifecycle: { readonly field: string; readonly options: readonly string[] } }
    >
  >;
};
export type TaskMetadataFinding = {
  readonly kind: "syntax" | "schema" | "unknown-binding";
  readonly location: string;
  readonly message: string;
};
export type TaskMetadataLint =
  | { readonly ok: true; readonly declaration: TaskMetadataDeclaration }
  | { readonly ok: false; readonly findings: readonly TaskMetadataFinding[] };
let validators:
  | {
      metadata: ValidateFunction<{ projects?: TaskMetadataDeclaration["projects"] }>;
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
export function lintTaskMetadataDeclaration(files: {
  readonly taskMetadata: string | undefined;
  readonly bindings: string | undefined;
}): TaskMetadataLint {
  const findings: TaskMetadataFinding[] = [];
  const validate = declarationValidators();
  const metadata = read(files.taskMetadata, validate.metadata, findings);
  const bindings = read(files.bindings, validate.bindings, []);
  if (metadata && bindings)
    for (const name of Object.keys(metadata.projects ?? {}))
      if (!Object.hasOwn(bindings.githubProjects ?? {}, name))
        findings.push({
          kind: "unknown-binding",
          location: `/projects/${pointer(name)}`,
          message: `GitHub Project binding is not declared: ${name}`,
        });
  return findings.length
    ? { ok: false, findings }
    : { ok: true, declaration: { projects: metadata!.projects ?? {} } };
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
