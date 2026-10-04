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

function readBlueprint(text: string): ExpressionBlueprint {
  const document: unknown = parse(text);
  if (!isRecord(document) || !isRecord(document["machine"]))
    throw new Error("expected a YAML mapping with a `machine` mapping");
  const schemas = document["schemas"];
  if (!isRecord(schemas) || !isRecord(schemas["events"]))
    throw new Error("expected `schemas` with an `events` mapping");
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
