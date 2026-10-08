// ---
// relationships:
//   implements: blueprint-expressions
// ---
import { createExpressionWorkerChannel } from "./expression-worker-channel.ts";
import { enqueueActions } from "xstate";
import type { MachineConfig } from "xstate";
import {
  collectExpressionSites,
  compileExpression,
  compileExpressionResult,
  ExpressionError,
  expressionsConfigurationSchema,
  createSchemaCompiler,
} from "@wyrd-company/manifold-shared";
import type { ExpressionBlueprint } from "@wyrd-company/manifold-shared";
import type { WorkerResult } from "./expression-worker.ts";

type Context = Record<string, unknown>;
type Event = { type: string; [key: string]: unknown };
type Params = { expression: string; location: string };
type Args = { context: Context; event: Event };
export interface ExpressionsConfiguration {
  readonly timeoutMs: number;
}
export const expressionsDefaults: ExpressionsConfiguration = Object.freeze({
  timeoutMs: expressionsConfigurationSchema.properties.timeoutMs.default,
});
let timeoutMs = expressionsDefaults.timeoutMs;
export function configureBlueprintExpressions(
  configuration: Partial<ExpressionsConfiguration> = {},
) {
  const next = configuration.timeoutMs ?? expressionsDefaults.timeoutMs;
  const range = expressionsConfigurationSchema.properties.timeoutMs;
  if (!Number.isInteger(next) || next < range.minimum || next > range.maximum)
    throw new RangeError("timeoutMs must be an integer from 250 to 60000");
  timeoutMs = next;
}
class WorkerWaitError extends ExpressionError {
  readonly timedOut: boolean;
  constructor(detail: ConstructorParameters<typeof ExpressionError>[0], timedOut: boolean) {
    super(detail);
    this.timedOut = timedOut;
  }
}
let channel: ReturnType<typeof createExpressionWorkerChannel> | undefined;
function evaluateSync(params: Params, input: unknown) {
  channel ??= createExpressionWorkerChannel({
    worker: new URL(
      import.meta.url.endsWith(".ts") ? "./expression-worker.ts" : "./expression-worker.js",
      import.meta.url,
    ),
  });
  const outcome = channel.evaluate(
    { source: params.expression, location: params.location, input },
    timeoutMs,
  );
  if (!outcome.ok)
    throw new WorkerWaitError(
      {
        kind: "evaluation",
        ...params,
        message:
          outcome.cause === "timeout"
            ? `Expression did not finish within ${timeoutMs} ms; the expression worker was restarted`
            : `The expression worker exited with code ${outcome.exitCode} during evaluation; the expression worker was restarted`,
      },
      outcome.cause === "timeout",
    );
  const result = outcome.value as WorkerResult;
  if ("error" in result) throw new ExpressionError(result.error);
  return result.value;
}

export function createBlueprintExpressions(
  blueprint: ExpressionBlueprint,
  options: { onError(error: ExpressionError): void },
) {
  const machine = structuredClone(blueprint.machine);
  const checks = new Map<string, ReturnType<typeof compileExpressionResult>>();
  const sites = collectExpressionSites(blueprint);
  function run(params: Params, args: Args, match = false) {
    return checks.get(params.location)!(
      evaluateSync(params, match ? args.event : { context: args.context, event: args.event }),
      args.context,
    );
  }
  function report(error: unknown, params: Params): ExpressionError {
    const failure =
      error instanceof ExpressionError
        ? error
        : new ExpressionError({
            kind: "evaluation",
            location: params.location,
            expression: params.expression,
            message: error instanceof Error ? error.message : String(error),
          });
    options.onError(failure);
    return failure;
  }
  for (const site of sites) {
    if (site.migration) continue;
    if (site.problem)
      throw new ExpressionError({
        kind: site.problem === "schema-missing" ? "schema" : "result",
        location: site.location,
        expression: site.expression,
        message:
          site.problem === "schema-missing"
            ? "Expression boundary schema is missing"
            : "Expression is not supported at this site",
      });
    compileExpression(site.expression, site.location);
    try {
      checks.set(site.location, compileExpressionResult(site));
    } catch (error) {
      throw new ExpressionError({
        kind: "schema",
        location: site.location,
        expression: site.expression,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    const keys = site.location
      .slice(1)
      .split("/")
      .map((k) => k.replaceAll("~1", "/").replaceAll("~0", "~"));
    let parent: Record<string, unknown> = machine;
    for (const key of keys.slice(0, -1)) parent = parent[key] as Record<string, unknown>;
    const key = keys.at(-1)!;
    const params = { expression: site.expression, location: site.location };
    if (site.kind === "expression.map")
      parent[key] = (args: Args) => {
        try {
          return run(params, args);
        } catch (error) {
          throw report(error, params);
        }
      };
    else parent[key] = { type: site.kind, params };
  }
  if (
    Object.values((machine["states"] ?? {}) as Record<string, Record<string, unknown>>).some(
      (state) => state["type"] === "final" && state["output"] !== undefined,
    )
  ) {
    machine["output"] = ({ event }: Args) => event["output"];
  }
  const guard = (match: boolean) => (args: Args, params: Params) => {
    try {
      return run(params, args, match) === true;
    } catch (error) {
      report(error, params);
      return false;
    }
  };
  return {
    migrateContext: contextMigration(blueprint),
    machine: machine as MachineConfig<Context, Event, never, never, never, never>,
    guards: { "expression.guard": guard(false), "expression.match": guard(true) },
    actions: {
      "expression.assign": enqueueActions<
        Context,
        Event,
        Params,
        Event,
        never,
        never,
        never,
        never
      >(({ context, event, enqueue }, params) => {
        try {
          const next = run(params, { context, event }) as Context;
          enqueue.assign(() => next);
        } catch (error) {
          const failure = report(error, params);
          enqueue.raise({ type: "expression.error", error: failure.detail });
        }
      }),
    },
  };
}

export type ContextMigration =
  | { status: "unchanged"; context: Readonly<Record<string, unknown>> }
  | { status: "mapped"; context: Readonly<Record<string, unknown>>; path: number }
  | {
      status: "failed";
      kind: "no-path" | "mapping-failed" | "mapping-timeout" | "context-rejected";
      message: string;
      detail: Record<string, import("./store/index.ts").JsonValue>;
    };
function contextMigration(blueprint: ExpressionBlueprint) {
  const validators = createSchemaCompiler()([
    blueprint.schemas.context ?? true,
    ...(blueprint.migrations ?? []).map((path) => path.from),
  ]);
  return (context: Readonly<Record<string, unknown>>): ContextMigration => {
    const own = Object.fromEntries(Object.entries(context).filter(([key]) => key !== "manifold"));
    if (validators[0]!(own)) return { status: "unchanged", context };
    const index = (blueprint.migrations ?? []).findIndex((_, index) => validators[index + 1]!(own));
    if (index === -1)
      return {
        status: "failed",
        kind: "no-path",
        message: "No migration path accepts the context",
        detail: { schemaErrors: JSON.parse(JSON.stringify(validators[0]!.errors ?? [])) },
      };
    const path = blueprint.migrations![index]!;
    const params = {
      expression: path.context.params.expression,
      location: `/migrations/${index}/context`,
    };
    try {
      const result = evaluateSync(params, { context });
      if (
        result === null ||
        typeof result !== "object" ||
        Array.isArray(result) ||
        Object.hasOwn(result, "manifold")
      )
        return {
          status: "failed",
          kind: "mapping-failed",
          message: "Migration must return an object without manifold",
          detail: {},
        };
      if (!validators[0]!(result))
        return {
          status: "failed",
          kind: "context-rejected",
          message: "Migration context does not match the target schema",
          detail: { schemaErrors: JSON.parse(JSON.stringify(validators[0]!.errors ?? [])) },
        };
      return { status: "mapped", context: result as Record<string, unknown>, path: index };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        status: "failed",
        kind:
          error instanceof WorkerWaitError && error.timedOut ? "mapping-timeout" : "mapping-failed",
        message,
        detail: error instanceof ExpressionError ? JSON.parse(JSON.stringify(error.detail)) : {},
      };
    }
  };
}
