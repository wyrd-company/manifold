// ---
// relationships:
//   implements: evaluate-blueprint-expressions-in-a-worker-thread
// ---
import { runAsWorker } from "synckit";
import {
  compileExpression,
  evaluateExpression,
  ExpressionError,
  assertExpressionData,
} from "@wyrd-company/manifold-shared";
import type { CompiledExpression, ExpressionErrorDetail } from "@wyrd-company/manifold-shared";

const compiled = new Map<string, CompiledExpression>();
export type WorkerResult = { value: unknown } | { error: ExpressionErrorDetail };
export async function evaluateInWorker(
  source: string,
  location: string,
  input: unknown,
): Promise<WorkerResult> {
  try {
    let expression = compiled.get(source);
    if (!expression) {
      expression = compileExpression(source, location);
      compiled.set(source, expression);
    }
    const value = await evaluateExpression({ ...expression, location }, input);
    assertExpressionData(value, { expression: source, location });
    return { value };
  } catch (error) {
    return {
      error:
        error instanceof ExpressionError
          ? error.detail
          : {
              kind: "evaluation",
              expression: source,
              location,
              message: error instanceof Error ? error.message : String(error),
            },
    };
  }
}
runAsWorker(evaluateInWorker);
