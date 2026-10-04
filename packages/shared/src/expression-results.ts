// ---
// relationships:
//   implements: blueprint-expressions
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import { ExpressionError, assertExpressionData } from "./expressions.ts";
import type { ExpressionSite } from "./expression-sites.ts";
import { record } from "./expression-sites.ts";

export { assertExpressionData } from "./expressions.ts";

export function compileExpressionResult(site: ExpressionSite) {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const schema = site.kind === "expression.assign" ? site.contextSchema : site.outputSchema;
  const validate = schema === undefined ? undefined : ajv.compile(schema);
  // Compile input schemas at the same load boundary, including guards and matches.
  if (site.contextSchema !== undefined) ajv.compile(site.contextSchema);
  for (const event of site.events) if (event.schema !== undefined) ajv.compile(event.schema);
  return (result: unknown, context?: unknown): unknown => {
    const fail = (kind: "result" | "schema", message: string) => {
      throw new ExpressionError({
        kind,
        location: site.location,
        expression: site.expression,
        message,
        ...(kind === "schema"
          ? {
              schemaErrors: (validate?.errors ?? []).map((e) => ({
                instancePath: e.instancePath,
                message: e.message ?? e.keyword,
              })),
            }
          : {}),
      });
    };
    assertExpressionData(result, site);
    if (site.kind === "expression.guard" || site.kind === "expression.match") {
      if (typeof result !== "boolean") fail("result", "Expression must return a boolean");
      return result;
    }
    if (site.kind === "expression.assign") {
      if (result === null || typeof result !== "object" || Array.isArray(result))
        fail("result", "Assignment must return an object");
      result = { ...record(context), ...record(result) };
    }
    if (validate && !validate(result))
      fail("schema", "Expression result does not match its schema");
    return result;
  };
}
