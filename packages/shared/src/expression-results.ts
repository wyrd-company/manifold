// ---
// relationships:
//   implements: blueprint-expressions
// ---
import { createSchemaCompiler } from "./schema-compiler.ts";
import { ExpressionError, assertExpressionData } from "./expressions.ts";
import type { ExpressionSite } from "./expression-sites.ts";
import { record } from "./expression-sites.ts";

export { assertExpressionData } from "./expressions.ts";

export function compileExpressionResult(
  site: ExpressionSite,
  compileSchema = createSchemaCompiler(),
) {
  const schema = site.kind === "expression.assign" ? site.contextSchema : site.outputSchema;
  const schemas = [];
  if (schema !== undefined) schemas.push(schema);
  // Keep input schemas in the same scope so event refs can resolve context ids.
  if (site.contextSchema !== undefined) schemas.push(site.contextSchema);
  for (const event of site.events) if (event.schema !== undefined) schemas.push(event.schema);
  const validators = compileSchema(schemas);
  const validate = schema === undefined ? undefined : validators[0];
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
