// ---
// relationships:
//   implements: [blueprint, blueprint-loader]
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { LineCounter, parseDocument } from "yaml";
import { createMachine, fromPromise } from "xstate";
import type { AnyStateMachine, MachineConfig } from "xstate";
import { blueprintSchema, blueprintExpressionsSchema } from "./blueprint-schema.ts";
import { lintBlueprintExpressions } from "./blueprint-expressions.ts";
import type { ExpressionBlueprint, ExpressionFinding } from "./blueprint-expressions.ts";
import type { ImplementationNames } from "./implementation-names.ts";
import { record, compareExpressionText } from "./expression-sites.ts";

export type BlueprintDocument = ExpressionBlueprint & { description?: string };
export type BlueprintFinding = {
  readonly path: string;
  readonly kind:
    | ExpressionFinding["kind"]
    | "yaml"
    | "shape"
    | "schema-invalid"
    | "implementation-unknown"
    | "machine"
    | "final-state-missing";
  readonly location: string;
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly implementationKind?: "actor" | "action" | "guard" | "delay";
  readonly name?: string;
} & Partial<Omit<ExpressionFinding, "kind" | "location" | "message">>;
export type BlueprintLint =
  | { readonly ok: true; readonly blueprint: BlueprintDocument }
  | { readonly ok: false; readonly findings: readonly BlueprintFinding[] };
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
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function jsonValue(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || ancestors.has(value)) return false;
  ancestors.add(value);
  const ok = Object.values(value).every((child) => jsonValue(child, ancestors));
  ancestors.delete(value);
  return ok;
}

export async function lintBlueprint(
  path: string,
  text: string,
  names: ImplementationNames,
): Promise<BlueprintLint> {
  const findings: BlueprintFinding[] = [];
  const finding = (
    kind: BlueprintFinding["kind"],
    location: string,
    message: string,
    extra: Partial<BlueprintFinding> = {},
  ) => findings.push({ path, kind, location, message, ...extra });
  let document: unknown;
  const lines = new LineCounter();
  try {
    const yaml = parseDocument(text, {
      version: "1.2",
      schema: "core",
      uniqueKeys: true,
      customTags: [],
      lineCounter: lines,
    });
    const problem = yaml.errors[0] ?? yaml.warnings[0];
    if (problem) {
      const position = lines.linePos(problem.pos[0]);
      finding("yaml", "", problem.message, { line: position.line, column: position.col });
      return { ok: false, findings };
    }
    if (yaml.directives?.yaml.version !== "1.2") throw new Error("Blueprint must use YAML 1.2");
    document = yaml.toJS();
    if (!jsonValue(document)) throw new Error("Document must round-trip through JSON unchanged");
  } catch (error) {
    finding("yaml", "", message(error), { line: 1, column: 1 });
    return { ok: false, findings };
  }
  const validate = validator();
  if (!validate(document)) {
    const byLocation = new Map<string, string>();
    for (const error of validate.errors ?? []) {
      const key =
        error.params["missingProperty"] ??
        error.params["additionalProperty"] ??
        error.params["propertyName"];
      const location = `${error.instancePath}${typeof key === "string" ? `/${pointer(key)}` : ""}`;
      if (!byLocation.has(location)) byLocation.set(location, error.message ?? error.keyword);
    }
    for (const [location, reason] of [...byLocation].sort(([a], [b]) =>
      compareExpressionText(a, b),
    ))
      finding("shape", location, reason);
    return { ok: false, findings };
  }
  const blueprint = document;
  const schemaEntries: [string, unknown][] = ["input", "output", "context"].map((key) => [
    `/schemas/${key}`,
    blueprint.schemas[key as "input" | "output" | "context"],
  ]);
  for (const [type, schema] of Object.entries(blueprint.schemas.events))
    schemaEntries.push([`/schemas/events/${pointer(type)}`, schema]);
  for (const [src, boundary] of Object.entries(blueprint.schemas.actors ?? {}))
    for (const key of ["input", "output"] as const)
      schemaEntries.push([`/schemas/actors/${pointer(src)}/${key}`, boundary[key]]);
  for (const [location, schema] of schemaEntries.sort(([a], [b]) => compareExpressionText(a, b))) {
    try {
      new Ajv2020({ allErrors: true, strict: false, validateFormats: false }).compile(
        schema as boolean | Record<string, unknown>,
      );
    } catch (error) {
      finding("schema-invalid", location, message(error));
    }
  }
  const schemaInvalid = findings.length > 0;
  const unknowns: BlueprintFinding[] = [];
  function reference(
    value: unknown,
    kind: "actor" | "action" | "guard" | "delay",
    location: string,
  ) {
    const name = typeof value === "string" ? value : (record(value)["type"] as string);
    const builtIn =
      kind === "guard"
        ? ["expression.guard", "expression.match"]
        : kind === "action"
          ? ["expression.assign"]
          : [];
    if (!names[`${kind}s`].has(name) && !builtIn.includes(name))
      unknowns.push({
        path,
        kind: "implementation-unknown",
        location,
        implementationKind: kind,
        name,
        message: "Implementation is not registered",
      });
  }
  function actions(value: unknown, location: string) {
    list(value).forEach((item, i) =>
      reference(item, "action", `${location}${Array.isArray(value) ? `/${i}` : ""}`),
    );
  }
  function transitions(value: unknown, location: string) {
    list(value).forEach((item, i) => {
      const transition = record(item),
        at = `${location}${Array.isArray(value) ? `/${i}` : ""}`;
      if (transition["guard"] !== undefined) reference(transition["guard"], "guard", `${at}/guard`);
      actions(transition["actions"], `${at}/actions`);
    });
  }
  function walk(config: Record<string, unknown>, location: string) {
    actions(config["entry"], `${location}/entry`);
    actions(config["exit"], `${location}/exit`);
    transitions(config["always"], `${location}/always`);
    transitions(config["onDone"], `${location}/onDone`);
    for (const [type, value] of Object.entries(record(config["on"])))
      transitions(value, `${location}/on/${pointer(type)}`);
    for (const [delay, value] of Object.entries(record(config["after"]))) {
      if (!/^\d+$/.test(delay)) reference(delay, "delay", `${location}/after/${pointer(delay)}`);
      transitions(value, `${location}/after/${pointer(delay)}`);
    }
    list(config["invoke"]).forEach((item, i) => {
      const invoke = record(item),
        at = `${location}/invoke${Array.isArray(config["invoke"]) ? `/${i}` : ""}`;
      reference(invoke["src"], "actor", `${at}/src`);
      for (const key of ["onDone", "onError", "onSnapshot"])
        transitions(invoke[key], `${at}/${key}`);
    });
    for (const [key, child] of Object.entries(record(config["states"])))
      walk(record(child), `${location}/states/${pointer(key)}`);
  }
  walk(blueprint.machine, "/machine");
  findings.push(...unknowns.sort((a, b) => compareExpressionText(a.location, b.location)));
  const machineFindings: BlueprintFinding[] = [];
  const nodeLocations = new Map<string, string>();
  const rootId =
    typeof blueprint.machine["id"] === "string" ? blueprint.machine["id"] : "(machine)";
  function locate(config: Record<string, unknown>, keys: string[], location: string) {
    const id = typeof config["id"] === "string" ? config["id"] : [rootId, ...keys].join(".");
    nodeLocations.set(id, location);
    for (const [key, child] of Object.entries(record(config["states"])))
      locate(record(child), [...keys, key], `${location}/states/${pointer(key)}`);
  }
  locate(blueprint.machine, [], "/machine");
  try {
    const machine = createMachine(
      blueprint.machine as MachineConfig<Record<string, unknown>, { type: string }>,
      {
        actors: Object.fromEntries(
          [...names.actors].map((name) => [name, fromPromise(async () => undefined)]),
        ),
      },
    );
    function resolve(node: AnyStateMachine["root"], location: string) {
      try {
        void node.initial;
        void node.transitions;
        void node.always;
        if (node.type === "history" && node.parent) {
          // XState resolves history defaults lazily, relative to the history node's parent.
          const parentId = node.parent.id.replaceAll("\\", "\\\\").replaceAll(".", "\\.");
          for (const target of list(node.config.target) as string[]) {
            machine.getStateNodeById(target.startsWith("#") ? target : `#${parentId}.${target}`);
          }
        }
      } catch (error) {
        machineFindings.push({ path, kind: "machine", location, message: message(error) });
      }
      for (const [key, child] of Object.entries(node.states))
        resolve(child, `${location}/states/${pointer(key)}`);
    }
    resolve(machine.root, "/machine");
  } catch (error) {
    const reason = message(error);
    const id = [...nodeLocations.keys()].find(
      (id) => reason.includes(`state node '${id}'`) || reason.includes(`state node "#${id}"`),
    );
    finding("machine", id ? (nodeLocations.get(id) ?? "/machine") : "/machine", reason);
  }
  findings.push(...machineFindings.sort((a, b) => compareExpressionText(a.location, b.location)));
  if (
    !Object.values(record(blueprint.machine["states"])).some(
      (value) => record(value)["type"] === "final",
    )
  )
    finding("final-state-missing", "/machine/states", "Machine requires a top-level final state");
  if (!schemaInvalid)
    for (const row of await lintBlueprintExpressions(blueprint))
      findings.push({ ...row, path, location: `/machine${row.location}` });
  return findings.length ? { ok: false, findings } : { ok: true, blueprint };
}
