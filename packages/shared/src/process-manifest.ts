// ---
// relationships:
//   implements: process-manifest
// ---
import type { ValidateFunction } from "ajv";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { processManifestSchema } from "./process-manifest-schema.ts";
import { decisionModelSchema } from "./decision-model-schema.ts";
import { lintDecisionModel } from "./decision-models.ts";
import type { DecisionModel, DecisionModelFinding } from "./decision-model-types.ts";
import { manifestFindingLocation } from "./process-manifest-locations.ts";
export interface ProcessManifest {
  readonly intake: { readonly decisionModel: string };
}
export interface ProcessManifestFinding {
  readonly file: string;
  readonly location: string;
  readonly severity: "error" | "warning";
  readonly kind:
    | "manifest-missing"
    | "syntax"
    | "schema"
    | "model-key-invalid"
    | "model-missing"
    | "model-syntax"
    | "decision-model";
  readonly message: string;
  readonly finding?: DecisionModelFinding;
}
export type ProcessManifestLint =
  | {
      readonly ok: true;
      readonly manifest: ProcessManifest;
      readonly models: Readonly<Record<string, unknown>>;
      readonly findings: readonly ProcessManifestFinding[];
    }
  | { readonly ok: false; readonly findings: readonly ProcessManifestFinding[] };
const ajv = new Ajv2020({ allErrors: true, strict: false });
ajv.addSchema(decisionModelSchema);
ajv.addSchema(processManifestSchema);
let validateManifest: ValidateFunction<ProcessManifest> | undefined;
let validateKey: ValidateFunction<string> | undefined;
export async function lintProcessManifest(
  read: (path: string) => Promise<string | undefined>,
): Promise<ProcessManifestLint> {
  validateManifest ??= ajv.compile<ProcessManifest>({
    $ref: processManifestSchema.$id + "#/$defs/manifest",
  });
  validateKey ??= ajv.compile<string>({ $ref: processManifestSchema.$id + "#/$defs/model-path" });
  const findings: ProcessManifestFinding[] = [];
  const add = (
    file: string,
    location: string,
    kind: ProcessManifestFinding["kind"],
    message: string,
  ) => findings.push({ file, location, kind, message, severity: "error" });
  const text = await read("manifold.yml");
  if (text === undefined) {
    add("manifold.yml", "", "manifest-missing", "Missing process manifest.");
    return { ok: false, findings };
  }
  let manifest: unknown;
  try {
    manifest = parse(text, { schema: "core", uniqueKeys: true });
    JSON.stringify(manifest);
  } catch (error) {
    add("manifold.yml", "", "syntax", String(error));
    return { ok: false, findings };
  }
  if (!validateManifest(manifest)) {
    for (const error of validateManifest.errors ?? [])
      add("manifold.yml", error.instancePath, "schema", error.message ?? "Invalid manifest.");
    return { ok: false, findings };
  }
  const queue = [
    { key: manifest.intake.decisionModel, file: "manifold.yml", location: "/intake/decisionModel" },
  ];
  const visited = new Set<string>();
  const models: Record<string, unknown> = {};
  for (const { key, file, location } of queue) {
    if (visited.has(key)) continue;
    visited.add(key);
    const source = await read(key);
    if (source === undefined) {
      add(file, location, "model-missing", `Missing model: ${key}`);
      continue;
    }
    let model: unknown;
    try {
      model = parse(source, { schema: "core", uniqueKeys: true });
      JSON.stringify(model);
    } catch (error) {
      add(key, "", "model-syntax", String(error));
      continue;
    }
    models[key] = model;
    const modelFindings = lintDecisionModel(model, key);
    for (const finding of modelFindings)
      findings.push({
        file: key,
        location: manifestFindingLocation(model as DecisionModel, finding),
        kind: "decision-model",
        severity: finding.severity,
        message: finding.message,
        finding,
      });
    // Inspect keys even when their value made the schema fail, but never inspect
    // unvalidated structure beyond a decision node's key boundary.
    if (
      typeof model === "object" &&
      model !== null &&
      "nodes" in model &&
      Array.isArray(model.nodes)
    ) {
      for (const [index, node] of model.nodes.entries())
        if (
          node &&
          typeof node === "object" &&
          node.type === "decisionNode" &&
          node.content &&
          typeof node.content === "object" &&
          "key" in node.content
        ) {
          const nested: unknown = node.content.key;
          const pointer = `/nodes/${index}/content/key`;
          if (!validateKey(nested))
            add(
              key,
              pointer,
              "model-key-invalid",
              "Model key must be a repository-relative .yml path.",
            );
          else if (!modelFindings.some((f) => f.kind === "structure"))
            queue.push({ key: nested, file: key, location: pointer });
        }
    }
  }
  return findings.some((f) => f.severity === "error")
    ? { ok: false, findings }
    : { ok: true, manifest, models, findings };
}
