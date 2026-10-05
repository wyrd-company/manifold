// ---
// relationships:
//   implements: declarations-api
//   references: task-metadata-declaration
// ---
// Structural stand-ins until the task metadata declaration seam merges.
import { Ajv2020 } from "ajv/dist/2020.js";
import { parseDocument, stringify } from "yaml";
import { lintTaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import { serviceConfigurationSchemas } from "@wyrd-company/manifold-shared";
import type { TaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type { StorageKind } from "@wyrd-company/manifold-shared/declarations-api";
import { schema } from "./seam-schema.ts";
export const taskFieldStorageKinds: readonly StorageKind[] = [
  { kind: "project-field", types: ["text", "number", "date", "single-select"], settings: ["name"] },
];
type Option = { name: string; color?: string; description?: string };
type Field = {
  type: "text" | "number" | "date" | "single-select";
  storage?: { kind: "project-field"; name?: string };
  whenChanged?: "revert" | "accept";
  options?: readonly (string | Option)[];
};
type Document = {
  projects?: Record<
    string,
    { lifecycle: { field: string; options: readonly string[] }; fields?: Record<string, Field> }
  >;
};
type NormalizedField = {
  type: Field["type"];
  storage: { kind: "project-field"; name: string };
  whenChanged: "revert" | "accept";
  options?: readonly Option[];
};
type Declaration = TaskMetadataDeclaration & {
  projects: Record<
    string,
    {
      lifecycle: { field: string; options: readonly string[] };
      fields: Record<string, NormalizedField>;
    }
  >;
};
type Finding = { kind: string; location: string; message: string };
const ajv = new Ajv2020({ allErrors: true, strict: false });
for (const companion of serviceConfigurationSchemas) ajv.addSchema(companion);
ajv.addSchema(schema);
const validate = ajv.compile<Document>({ $ref: `${schema.$id}#/$defs/declaration` });
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
export function lintTaskMetadata(files: {
  taskMetadata: string | undefined;
  bindings: string | undefined;
}): { ok: true; declaration: Declaration } | { ok: false; findings: readonly Finding[] } {
  const doc = parseDocument(files.taskMetadata ?? "", {
    version: "1.2",
    schema: "core",
    uniqueKeys: true,
    customTags: [],
  });
  if (doc.errors.length || doc.warnings.length || doc.directives.yaml.version !== "1.2")
    return {
      ok: false,
      findings: [
        {
          kind: "syntax",
          location: "",
          message: (doc.errors[0] ?? doc.warnings[0])?.message ?? "Declaration must use YAML 1.2",
        },
      ],
    };
  const value: unknown = doc.toJS() ?? {};
  if (!validate(value)) {
    const locations = new Set<string>();
    const findings: Finding[] = [];
    for (const error of validate.errors ?? []) {
      const property =
        error.propertyName ?? error.params["missingProperty"] ?? error.params["additionalProperty"];
      const location =
        error.instancePath + (typeof property === "string" ? `/${pointer(property)}` : "");
      if (!locations.has(location)) {
        locations.add(location);
        findings.push({
          kind: "schema",
          location,
          message: error.message ?? "Invalid declaration.",
        });
      }
    }
    return { ok: false, findings };
  }
  const lifecycle = Object.fromEntries(
    Object.entries(value.projects ?? {}).map(([binding, project]) => [
      binding,
      { lifecycle: project.lifecycle },
    ]),
  );
  const old = lintTaskMetadataDeclaration({
    taskMetadata: stringify({ projects: lifecycle }),
    bindings: files.bindings,
  });
  if (!old.ok) return old;
  const projects: Declaration["projects"] = {};
  const findings: Finding[] = [];
  for (const [binding, project] of Object.entries(value.projects ?? {})) {
    const fields: Record<string, NormalizedField> = {};
    const names = new Set([project.lifecycle.field]);
    for (const [name, field] of Object.entries(project.fields ?? {})) {
      const location = `/projects/${pointer(binding)}/fields/${pointer(name)}`;
      const storedName = field.storage?.name ?? name;
      if (names.has(storedName))
        findings.push({
          kind: "duplicate-field",
          location,
          message: "Two fields use the same Project field.",
        });
      names.add(storedName);
      const options = field.options?.map((option) =>
        typeof option === "string" ? { name: option } : option,
      );
      const seen = new Set<string>();
      for (const [index, option] of (options ?? []).entries()) {
        if (seen.has(option.name))
          findings.push({
            kind: "duplicate-option",
            location: `${location}/options/${index}`,
            message: "Option name is already used.",
          });
        seen.add(option.name);
      }
      fields[name] = {
        type: field.type,
        storage: { kind: "project-field", name: storedName },
        whenChanged: field.whenChanged ?? "revert",
        ...(options ? { options } : {}),
      };
    }
    projects[binding] = { lifecycle: project.lifecycle, fields };
  }
  return findings.length ? { ok: false, findings } : { ok: true, declaration: { projects } };
}

export { lintAllocatedAccounts } from "./allocated-account-seam.ts";
