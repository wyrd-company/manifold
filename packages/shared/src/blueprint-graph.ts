// ---
// relationships:
//   implements: [blueprints-api, operator-console]
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { parseDocument } from "yaml";
import { createMachine, fromPromise } from "xstate";
import type { AnyStateMachine, MachineConfig } from "xstate";
import { blueprintSchema, blueprintExpressionsSchema } from "./blueprint-schema.ts";
import { compileStateGuards } from "./state-guards.ts";
import { record } from "./expression-sites.ts";
import { findingRanges } from "./finding-ranges.ts";
import type { BlueprintGraph, GraphState, GraphTransition } from "./blueprints-api.ts";
import type { BlueprintDocument } from "./blueprint-lint.ts";

let blueprintValidator: ValidateFunction<BlueprintDocument> | undefined;
function validator() {
  if (!blueprintValidator) {
    const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
    ajv.addSchema(blueprintExpressionsSchema);
    ajv.addSchema(blueprintSchema);
    blueprintValidator = ajv.compile<BlueprintDocument>({
      $ref: `${blueprintSchema.$id}#/$defs/blueprint`,
    });
  }
  return blueprintValidator;
}
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
type StateNode = AnyStateMachine["root"];
type ResolvedTransition =
  StateNode["transitions"] extends Map<string, infer T>
    ? T extends (infer R)[]
      ? R
      : never
    : never;

function jsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  const valid = Object.values(value).every((child) => jsonValue(child, ancestors));
  ancestors.delete(value);
  return valid;
}

export function blueprintGraph(text: string): BlueprintGraph | undefined {
  try {
    const yaml = parseDocument(text, {
      version: "1.2",
      schema: "core",
      uniqueKeys: true,
      customTags: [],
    });
    if (yaml.errors.length || yaml.warnings.length || yaml.directives?.yaml.version !== "1.2")
      return undefined;
    const document: unknown = yaml.toJS();
    if (!jsonValue(document) || !validator()(document)) return undefined;
    const actors = new Set<string>();
    function names(config: Record<string, unknown>) {
      for (const invoke of list(config["invoke"])) {
        const src = record(invoke)["src"];
        if (typeof src === "string") actors.add(src);
      }
      for (const child of Object.values(record(config["states"]))) names(record(child));
    }
    names(document.machine);
    const machine = createMachine(
      compileStateGuards(document.machine) as MachineConfig<
        Record<string, unknown>,
        { type: string }
      >,
      {
        actors: Object.fromEntries(
          [...actors].map((name) => [name, fromPromise(async () => undefined)]),
        ),
      },
    );
    const states: GraphState[] = [];
    const transitions: GraphTransition[] = [];
    function emit(
      node: StateNode,
      rows: readonly ResolvedTransition[],
      value: unknown,
      location: string,
      trigger: GraphTransition["trigger"],
      label: string,
    ) {
      rows.forEach((row, index) => {
        const base = {
          source: node.path.join("."),
          trigger,
          label,
          guarded: row.guard !== undefined,
          location: `${location}${Array.isArray(value) ? `/${index}` : ""}`,
        };
        if (!row.target?.length) transitions.push(base);
        else
          for (const target of row.target)
            transitions.push({ ...base, target: target.path.join(".") });
      });
    }
    function walk(node: StateNode, location: string) {
      // Force every lazy XState resolution, including nodes without graph edges.
      const initial = node.initial;
      const resolved = node.transitions;
      const always = node.always;
      if (node.type === "history" && node.parent) {
        const parentId = node.parent.id.replaceAll("\\", "\\\\").replaceAll(".", "\\.");
        for (const target of list(node.config.target) as string[])
          machine.getStateNodeById(target.startsWith("#") ? target : `#${parentId}.${target}`);
      }
      if (node.parent)
        states.push({
          path: node.path.join("."),
          key: node.key,
          ...(node.parent.parent ? { parent: node.parent.path.join(".") } : {}),
          type: node.type,
          initial: node.parent.initial.target?.includes(node) ?? false,
          invokes: list(node.config.invoke).map((invoke) => String(record(invoke)["src"])),
          gated: "gate" in record(node.config.meta),
          location,
        });
      void initial;
      for (const [key, value] of Object.entries(node.config)) {
        const at = `${location}/${pointer(key)}`;
        if (key === "states")
          for (const [childKey, child] of Object.entries(node.states))
            walk(child, `${at}/${pointer(childKey)}`);
        if (!node.parent) continue;
        if (key === "on")
          for (const [event, row] of Object.entries(record(value)))
            emit(node, resolved.get(event) ?? [], row, `${at}/${pointer(event)}`, "event", event);
        if (key === "always") emit(node, always ?? [], value, at, "always", "");
        if (key === "after")
          for (const [delay, row] of Object.entries(record(value)))
            emit(
              node,
              node.after.filter((transition) => String(transition.delay) === delay),
              row,
              `${at}/${pointer(delay)}`,
              "after",
              delay,
            );
        if (key === "onDone")
          emit(
            node,
            resolved.get(`xstate.done.state.${node.id}`) ?? [],
            value,
            at,
            "done",
            node.id,
          );
        if (key === "invoke")
          list(value).forEach((invoke, index) => {
            const config = record(invoke);
            const id = node.invoke[index]?.id ?? String(config["id"]);
            const invokeLocation = `${at}${Array.isArray(value) ? `/${index}` : ""}`;
            for (const [event, row] of Object.entries(config)) {
              if (event === "onDone")
                emit(
                  node,
                  resolved.get(`xstate.done.actor.${id}`) ?? [],
                  row,
                  `${invokeLocation}/onDone`,
                  "done",
                  id,
                );
              if (event === "onError")
                emit(
                  node,
                  resolved.get(`xstate.error.actor.${id}`) ?? [],
                  row,
                  `${invokeLocation}/onError`,
                  "error",
                  id,
                );
            }
          });
      }
    }
    walk(machine.root, "/machine");
    const ranges = findingRanges(
      text,
      states.map((state) => ({ path: "", kind: "shape", location: state.location, message: "" })),
    );
    return {
      states: states.map((state, index) => {
        const range = ranges[index]?.range;
        return range ? { ...state, range } : state;
      }),
      transitions,
    };
  } catch {
    return undefined;
  }
}
