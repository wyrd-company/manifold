// ---
// relationships:
//   implements: host-cli-expressions-lint
// ---
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { lintBlueprintExpressions } from "@wyrd-company/manifold-shared";
import type { ExpressionBlueprint, ExpressionFinding } from "@wyrd-company/manifold-shared";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSchema = (value: unknown) => typeof value === "boolean" || isRecord(value);

// Checks every schema value the lint reads, so a malformed file is refused before any lint
// output. An absent schema is the lint's own `schema-missing` finding, and other keys pass.
function schemaProblem(schemas: Record<string, unknown>): string | undefined {
  for (const key of ["input", "output", "context"])
    if (schemas[key] !== undefined && !isSchema(schemas[key]))
      return `\`schemas.${key}\` must be a JSON Schema (a mapping or a boolean)`;
  const events = schemas["events"];
  if (!isRecord(events)) return "expected `schemas` with an `events` mapping";
  for (const [type, schema] of Object.entries(events))
    if (!isSchema(schema)) return `\`schemas.events.${type}\` must be a JSON Schema`;
  const actors = schemas["actors"];
  if (actors === undefined) return undefined;
  if (!isRecord(actors)) return "`schemas.actors` must be a mapping";
  for (const [src, boundary] of Object.entries(actors)) {
    if (!isRecord(boundary)) return `\`schemas.actors.${src}\` must be a mapping`;
    for (const key of ["input", "output"])
      if (boundary[key] !== undefined && !isSchema(boundary[key]))
        return `\`schemas.actors.${src}.${key}\` must be a JSON Schema`;
  }
  return undefined;
}

function readBlueprint(text: string): ExpressionBlueprint {
  const document: unknown = parse(text);
  if (!isRecord(document) || !isRecord(document["machine"]))
    throw new Error("expected a YAML mapping with a `machine` mapping");
  const schemas = document["schemas"];
  if (!isRecord(schemas)) throw new Error("expected `schemas` with an `events` mapping");
  const problem = schemaProblem(schemas);
  if (problem) throw new Error(problem);
  return document as ExpressionBlueprint;
}

function line(file: string, finding: ExpressionFinding) {
  const sample = finding.sample
    ? ` (sample ${finding.sample}${finding.eventType ? `, event ${finding.eventType}` : ""})`
    : "";
  return `${file}:${finding.location} ${finding.kind} ${finding.message}${sample}`;
}

export async function expressionsLintCommand(files: readonly string[]) {
  if (files.length === 0) {
    console.error("Usage: manifold-host expressions lint <file>...");
    return 2;
  }
  const blueprints = [];
  for (const name of files) {
    try {
      blueprints.push({ name, blueprint: readBlueprint(await readFile(name, "utf8")) });
    } catch (error) {
      console.error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
      return 2;
    }
  }
  let exitCode = 0;
  for (const { name, blueprint } of blueprints) {
    for (const finding of await lintBlueprintExpressions(blueprint)) {
      console.log(line(name, finding));
      exitCode = 1;
    }
  }
  return exitCode;
}
