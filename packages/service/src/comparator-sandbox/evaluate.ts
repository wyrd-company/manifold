// ---
// relationships:
//   implements: comparator-sandbox
//   references: comparator-contract
// ---
import { DefaultIntrinsics, Scope } from "quickjs-emscripten-core";
import type { QuickJSWASMModule } from "quickjs-emscripten-core";
import type { ComparatorSelection } from "@wyrd-company/manifold-shared/comparator.d.ts";
import type {
  ComparatorSource,
  ComparatorSandboxLimits,
  ComparatorInputData,
  ComparatorFailure,
  ComparatorEvaluation,
} from "./index.ts";

const prelude = `(() => {
  const parse = JSON.parse, stringify = JSON.stringify, imul = Math.imul, SerializationError = TypeError;
  Math.random = () => { throw new TypeError('Math.random is unavailable; use input.random'); };
  return (comparator, json, seed) => {
    const input = parse(json);
    let a = seed >>> 0;
    input.random = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = imul(t ^ (t >>> 15), t | 1);
      t ^= t + imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const result = comparator(input);
    if (result === undefined || (result !== null && typeof result.then === 'function')) return undefined;
    try { return stringify(result); }
    catch (error) { if (error instanceof SerializationError) return undefined; throw error; }
  };
})()`;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function selection(
  value: unknown,
  input: ComparatorInputData,
): value is ComparatorSelection | null {
  if (value === null) return true;
  if (
    !object(value) ||
    Object.keys(value).some((key) => key !== "task" && key !== "reservations") ||
    typeof value["task"] !== "string" ||
    !input.population.some((task) => task.id === value["task"])
  )
    return false;
  if (!("reservations" in value)) return true;
  return (
    Array.isArray(value["reservations"]) &&
    value["reservations"].every(
      (reservation) =>
        object(reservation) &&
        Object.keys(reservation).every((key) => key === "account" || key === "amount") &&
        typeof reservation["account"] === "string" &&
        reservation["account"].length > 0 &&
        typeof reservation["amount"] === "number" &&
        Number.isFinite(reservation["amount"]) &&
        reservation["amount"] > 0,
    )
  );
}
class EvaluationFailure extends Error {
  readonly failure: ComparatorFailure;
  constructor(failure: ComparatorFailure) {
    super(failure.message);
    this.failure = failure;
  }
}

export function evaluateScope(
  module: QuickJSWASMModule,
  source: ComparatorSource,
  code: string,
  limits: ComparatorSandboxLimits,
  input?: ComparatorInputData,
  seed = 0,
  onEngineFailure: (failure: ComparatorFailure) => void = () => {},
  memoryGrowthFailed: () => boolean = () => false,
): ComparatorEvaluation {
  const start = performance.now();
  let outcome:
    | Omit<Extract<ComparatorEvaluation, { ok: true }>, "durationMs">
    | Omit<Extract<ComparatorEvaluation, { ok: false }>, "durationMs">;
  try {
    outcome = Scope.withScope((handles) => {
      const runtime = handles.manage(module.newRuntime());
      runtime.setMemoryLimit(limits.memoryLimitMiB * 1024 * 1024);
      runtime.setMaxStackSize(1024 * 1024);
      runtime.setInterruptHandler(() => performance.now() > start + limits.timeoutMs);
      const context = handles.manage(
        runtime.newContext({ intrinsics: { ...DefaultIntrinsics, Date: false } }),
      );
      const unwrap = (result: ReturnType<typeof context.evalCode>) => {
        if (result.error) {
          handles.manage(result.error);
          const error: unknown = context.dump(result.error);
          const name = object(error) ? String(error["name"]) : "Error";
          const message = object(error) ? String(error["message"]) : String(error);
          const kind =
            error === null && memoryGrowthFailed()
              ? "memory"
              : name === "InternalError" && message === "interrupted"
                ? "timeout"
                : name === "InternalError" && message === "out of memory"
                  ? "memory"
                  : "thrown";
          throw new EvaluationFailure({ kind, message: `${source.name}: ${name}: ${message}` });
        }
        return handles.manage(result.value);
      };
      const run = unwrap(context.evalCode(prelude, "prelude.js", { type: "global" }));
      const namespace = unwrap(context.evalCode(code, source.name, { type: "module" }));
      const fn = handles.manage(context.getProp(namespace, "default"));
      if (context.typeof(fn) !== "function")
        throw new EvaluationFailure({
          kind: "module",
          message: `${source.name}: Expected a synchronous module with a default function`,
        });
      if (!input) return { ok: true as const, selection: null };
      const json = handles.manage(context.newString(JSON.stringify(input)));
      const seedHandle = handles.manage(context.newNumber(seed));
      const output = unwrap(context.callFunction(run, context.undefined, fn, json, seedHandle));
      if (context.typeof(output) !== "string")
        throw new EvaluationFailure({
          kind: "invalid-output",
          message: `${source.name}: Expected a synchronous JSON selection`,
        });
      const value: unknown = JSON.parse(context.getString(output));
      if (!selection(value, input))
        throw new EvaluationFailure({
          kind: "invalid-output",
          message: `${source.name}: Selection does not match the comparator contract or population`,
        });
      return { ok: true as const, selection: value };
    });
  } catch (error) {
    outcome = {
      ok: false,
      failure:
        error instanceof EvaluationFailure
          ? error.failure
          : { kind: "engine", message: `${source.name}: ${String(error)}` },
    };
  }
  if (!outcome.ok && outcome.failure.kind === "engine") onEngineFailure(outcome.failure);
  const durationMs = performance.now() - start;
  if (durationMs > limits.timeoutMs)
    return {
      ok: false,
      failure: {
        kind: "timeout",
        message: `${source.name}: Evaluation exceeded timeoutMs (${limits.timeoutMs})`,
      },
      durationMs,
    };
  return { ...outcome, durationMs };
}
