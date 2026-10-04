// ---
// relationships:
//   implements: blueprint-expressions
// ---
import jsonata from "jsonata";
import { record } from "./expression-sites.ts";

export type ExpressionErrorDetail = {
  kind: "syntax" | "evaluation" | "result" | "schema";
  location: string;
  expression: string;
  message: string;
  code?: string;
  position?: number;
  schemaErrors?: readonly { instancePath: string; message: string }[];
};

export class ExpressionError extends Error {
  readonly detail: ExpressionErrorDetail;
  constructor(detail: ExpressionErrorDetail) {
    super(`${detail.location}: ${detail.message}`);
    this.name = "ExpressionError";
    this.detail = detail;
  }
}

export type CompiledExpression = {
  readonly source: string;
  readonly location: string;
  readonly expression: jsonata.Expression;
};

function jsonataError(
  kind: "syntax" | "evaluation",
  source: string,
  location: string,
  error: unknown,
) {
  const info = error as { message?: string; code?: string; position?: number };
  return new ExpressionError({
    kind,
    expression: source,
    location,
    message: info.message ?? String(error),
    ...(typeof info.code === "string" ? { code: info.code } : {}),
    ...(typeof info.position === "number" ? { position: info.position } : {}),
  });
}

export function compileExpression(source: string, location: string): CompiledExpression {
  try {
    return { source, location, expression: jsonata(source) };
  } catch (error) {
    throw jsonataError("syntax", source, location, error);
  }
}

export async function evaluateExpression(
  compiled: CompiledExpression,
  input: unknown,
  bindings?: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await compiled.expression.evaluate(input, bindings);
  } catch (error) {
    throw jsonataError("evaluation", compiled.source, compiled.location, error);
  }
}

export function assertExpressionData(
  value: unknown,
  site: { location: string; expression: string },
): void {
  const seen = new Set<object>();
  function visit(item: unknown) {
    if (
      typeof item === "function" ||
      record(item)["_jsonata_lambda"] ||
      record(item)["_jsonata_function"]
    ) {
      throw new ExpressionError({
        kind: "result",
        location: site.location,
        expression: site.expression,
        message: "Expression returned a function",
      });
    }
    if (item === null || typeof item !== "object" || seen.has(item)) return;
    seen.add(item);
    for (const child of Object.values(item)) visit(child);
  }
  visit(value);
}
