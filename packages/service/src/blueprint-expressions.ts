// ---
// relationships:
//   implements: blueprint-expressions
// ---
import { createSyncFn } from "synckit";
import { enqueueActions } from "xstate";
import type { MachineConfig } from "xstate";
import {
  collectExpressionSites,
  compileExpression,
  compileExpressionResult,
  ExpressionError,
} from "@wyrd-company/manifold-shared";
import type { ExpressionBlueprint } from "@wyrd-company/manifold-shared";
import type { evaluateInWorker } from "./expression-worker.ts";

type Context = Record<string, unknown>;
type Event = { type: string; [key: string]: unknown };
type Params = { expression: string; location: string };
type Args = { context: Context; event: Event };
let evaluate: ReturnType<typeof createSyncFn<typeof evaluateInWorker>> | undefined;
function evaluateSync(params: Params, input: unknown) {
  // Infinity overrides SYNCKIT_TIMEOUT as well as the library default.
  evaluate ??= createSyncFn<typeof evaluateInWorker>(
    new URL(
      import.meta.url.endsWith(".ts") ? "./expression-worker.ts" : "./expression-worker.js",
      import.meta.url,
    ),
    { timeout: Infinity, tsRunner: "node" },
  );
  const result = evaluate(params.expression, params.location, input);
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
