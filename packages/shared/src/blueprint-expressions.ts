// ---
// relationships:
//   implements: blueprint-expressions
// ---
import { blueprintSchema } from "./blueprint-schema.ts";
import { record } from "./expression-sites.ts";
import { createSchemaCompiler } from "./schema-compiler.ts";
import { generateSync } from "json-schema-faker";
import type { JsonSchema } from "json-schema-faker";
import { compileExpression, evaluateExpression, ExpressionError } from "./expressions.ts";
import type { ExpressionErrorDetail } from "./expressions.ts";
import { collectExpressionSites, compareExpressionText } from "./expression-sites.ts";
import type { ExpressionBlueprint, Schema } from "./expression-sites.ts";
import { compileExpressionResult } from "./expression-results.ts";
export { collectExpressionSites } from "./expression-sites.ts";
export type { ExpressionBlueprint, ExpressionSite, Schema } from "./expression-sites.ts";

export type ExpressionFinding = Omit<ExpressionErrorDetail, "kind"> & {
  kind: ExpressionErrorDetail["kind"] | "schema-missing" | "site-unsupported";
  sample?: string;
  eventType?: string;
};
function samples(schema: Schema): { name: string; value: unknown }[] {
  const examples =
    typeof schema === "object" && Array.isArray(schema["examples"]) ? schema["examples"] : [];
  // Ignore top-level examples for generated samples, but honor nested examples/defaults.
  const generatedSchema = typeof schema === "object" ? { ...schema, examples: undefined } : schema;
  return [
    ...examples.map((value, i) => ({ name: `examples[${i}]`, value })),
    ...["full", "required"].map((name) => ({
      name,
      value: generateSync(generatedSchema as JsonSchema, {
        seed: 1,
        optionalsProbability: name === "full" ? 1 : 0,
        alwaysFakeOptionals: name === "full",
        useDefaultValue: true,
        useExamplesValue: true,
        filterExampleDefaults: true,
        minDateTime: "1970-01-01T00:00:00Z",
        maxDateTime: "1970-01-01T00:00:00Z",
      }),
    })),
  ];
}
function random(seed: string) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export async function lintBlueprintExpressions(
  blueprint: ExpressionBlueprint,
  compileSchema = createSchemaCompiler(),
): Promise<readonly ExpressionFinding[]> {
  const findings: ExpressionFinding[] = [];
  for (const site of collectExpressionSites(blueprint)) {
    if (site.problem) {
      findings.push({
        kind: site.problem,
        location: site.location,
        expression: site.expression,
        message:
          site.problem === "schema-missing"
            ? "Expression boundary schema is missing"
            : "Expression is not supported at this site",
      });
      continue;
    }
    let compiled;
    try {
      compiled = compileExpression(site.expression, site.location);
    } catch (error) {
      findings.push((error as ExpressionError).detail);
      continue;
    }
    if (!site.events.length) continue;
    try {
      const check = compileExpressionResult(site, compileSchema);
      const contexts =
        site.kind === "expression.match"
          ? [{ name: "required", value: undefined }]
          : samples(site.contextSchema!);
      const identity = samples({
        ...blueprintSchema.$defs["actor-identity"],
        $defs: blueprintSchema.$defs,
      }).find((sample) => sample.name === "full")!.value;
      for (const event of site.events) {
        for (const context of contexts)
          for (const sample of samples(event.schema!)) {
            const name = context.name.startsWith("examples[")
              ? context.name
              : sample.name.startsWith("examples[")
                ? sample.name
                : context.name === "full" || sample.name === "full"
                  ? "full"
                  : "required";
            try {
              const contextValue = {
                ...record(context.value),
                manifold: context.name === "required" ? {} : identity,
              };
              const fromMillis = compileExpression(
                "$fromMillis($value, $picture, $timezone)",
                site.location,
              );
              const result = await evaluateExpression(
                compiled,
                site.kind === "expression.match"
                  ? sample.value
                  : { context: contextValue, event: sample.value },
                {
                  millis: () => 0,
                  now: (picture?: string, timezone?: string) =>
                    evaluateExpression(fromMillis, {}, { value: 0, picture, timezone }),
                  random: random(`${site.location}:${event.type}:${context.name}:${sample.name}`),
                },
              );
              check(result, contextValue);
            } catch (error) {
              findings.push({
                ...(error as ExpressionError).detail,
                sample: name,
                eventType: event.type,
              });
            }
          }
      }
    } catch (error) {
      findings.push({
        kind: "schema",
        location: site.location,
        expression: site.expression,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return findings.sort(
    (a, b) =>
      compareExpressionText(a.location, b.location) ||
      compareExpressionText(a.sample ?? "", b.sample ?? "") ||
      compareExpressionText(a.eventType ?? "", b.eventType ?? ""),
  );
}
