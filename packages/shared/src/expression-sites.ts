// ---
// relationships:
//   implements: blueprint-expressions
// ---
export const compareExpressionText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type Schema = boolean | Record<string, unknown>;
export type ExpressionBlueprint = {
  migrations?: readonly {
    from: Schema;
    context: { type: string; params: { expression: string } };
    description?: string;
  }[];
  machine: Record<string, unknown>;
  schemas: {
    input?: Schema;
    output?: Schema;
    context?: Schema;
    events: Record<string, Schema>;
    actors?: Record<string, { input?: Schema; output?: Schema }>;
  };
};
export type ExpressionKind =
  | "expression.guard"
  | "expression.match"
  | "expression.assign"
  | "expression.map";
export type ExpressionSite = {
  location: string;
  expression: string;
  kind: ExpressionKind;
  events: readonly { type: string; schema: Schema | undefined }[];
  contextSchema: Schema | undefined;
  outputSchema: Schema | undefined;
  migration?: boolean;
  problem?: "schema-missing" | "site-unsupported";
};
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
const list = (value: unknown): unknown[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];
const pointer = (value: string) => value.replaceAll("~", "~0").replaceAll("/", "~1");
const eventSchema = (type: string, properties: Record<string, Schema> = {}) => ({
  type: "object",
  properties: { type: { const: type }, ...properties },
  required: ["type", ...Object.keys(properties)],
});
// This is the closed service event contract; it does not come from user schemas.
export const expressionErrorEventSchema: Schema = {
  ...eventSchema("expression.error", {
    error: {
      type: "object",
      properties: {
        kind: { enum: ["syntax", "evaluation", "result", "schema"] },
        location: { type: "string" },
        expression: { type: "string" },
        message: { type: "string" },
        code: { type: "string" },
        position: { type: "integer", minimum: 0 },
        schemaErrors: {
          type: "array",
          items: {
            type: "object",
            properties: { instancePath: { type: "string" }, message: { type: "string" } },
            required: ["instancePath", "message"],
          },
        },
      },
      required: ["kind", "location", "expression", "message"],
      additionalProperties: false,
    },
  }),
  additionalProperties: false,
};

type Events = Map<string, Schema | undefined>;
type State = {
  config: Record<string, unknown>;
  path: string;
  id: string;
  key: string;
  parent?: State;
  children: State[];
  entry: Events;
  exit: Events;
  always: Events;
};
type Transition = {
  source: State;
  config: Record<string, unknown>;
  path: string;
  events: Events;
};
const union = (destination: Events, source: Events) => {
  for (const [type, schema] of source) destination.set(type, schema);
};
function ancestor(parent: State, child: State): boolean {
  return parent === child || (!!child.parent && ancestor(parent, child.parent));
}
function initial(state: State): State[] {
  const children =
    state.config["type"] === "parallel"
      ? state.children
      : state.children.filter(
          (s) =>
            s.key ===
            (typeof state.config["initial"] === "string"
              ? state.config["initial"]
              : record(state.config["initial"])["target"]),
        );
  return [state, ...children.flatMap(initial)];
}
function compatible(source: State, candidate: State): boolean {
  if (ancestor(source, candidate) || ancestor(candidate, source)) return true;
  let common = source.parent;
  while (common && !ancestor(common, candidate)) common = common.parent;
  return common?.config["type"] === "parallel";
}

export function collectExpressionSites(blueprint: ExpressionBlueprint): readonly ExpressionSite[] {
  const { schemas } = blueprint;
  const states: State[] = [];
  function build(
    config: Record<string, unknown>,
    path: string,
    key: string,
    id: string,
    parent?: State,
  ): State {
    const state: State = {
      config,
      path,
      key,
      id: typeof config["id"] === "string" ? config["id"] : id,
      children: [],
      entry: new Map(),
      exit: new Map(),
      always: new Map(),
      ...(parent ? { parent } : {}),
    };
    states.push(state);
    state.children = Object.entries(record(config["states"])).map(([name, value]) =>
      build(record(value), `${path}/states/${pointer(name)}`, name, `${id}.${name}`, state),
    );
    return state;
  }
  const root = build(
    blueprint.machine,
    "",
    "",
    typeof blueprint.machine["id"] === "string" ? blueprint.machine["id"] : "(machine)",
  );
  const transitions: Transition[] = [];
  function add(source: State, value: unknown, path: string, events: Events) {
    if (Array.isArray(value)) {
      value.forEach((item, i) => add(source, item, `${path}/${i}`, events));
      return;
    }
    if (value === undefined) return;
    transitions.push({
      source,
      config: typeof value === "string" ? { target: value } : record(value),
      path,
      events,
    });
  }
  const declared = new Map(Object.entries(schemas.events));
  declared.set("expression.error", expressionErrorEventSchema);
  for (const state of states) {
    for (const [type, value] of Object.entries(record(state.config["on"]))) {
      const events = new Map<string, Schema | undefined>();
      if (type === "*" || type.endsWith(".*")) {
        for (const [eventType, schema] of declared)
          if (type === "*" || eventType.startsWith(type.slice(0, -1)))
            events.set(eventType, schema);
      } else events.set(type, declared.get(type));
      add(state, value, `${state.path}/on/${pointer(type)}`, events);
    }
    add(state, state.config["always"], `${state.path}/always`, state.always);
    add(
      state,
      state.config["onDone"],
      `${state.path}/onDone`,
      new Map([
        [
          `xstate.done.state.${state.id}`,
          eventSchema(`xstate.done.state.${state.id}`, { output: true }),
        ],
      ]),
    );
    for (const [delay, value] of Object.entries(record(state.config["after"]))) {
      const type = `xstate.after.${delay}.${state.id}`;
      add(
        state,
        value,
        `${state.path}/after/${pointer(delay)}`,
        new Map([[type, eventSchema(type)]]),
      );
    }
    list(state.config["invoke"]).forEach((value, i) => {
      const invoke = record(value),
        id = typeof invoke["id"] === "string" ? invoke["id"] : `${i}.${state.id}`;
      const path = `${state.path}/invoke${Array.isArray(state.config["invoke"]) ? `/${i}` : ""}`;
      const output =
        typeof invoke["src"] === "string" ? schemas.actors?.[invoke["src"]]?.output : undefined;
      for (const [key, type, props] of [
        ["onDone", `xstate.done.actor.${id}`, { output: output ?? true }],
        ["onError", `xstate.error.actor.${id}`, { error: true }],
        ["onSnapshot", `xstate.snapshot.${id}`, { snapshot: true }],
      ] as const)
        add(
          state,
          invoke[key],
          `${path}/${key}`,
          new Map([
            [type, key === "onDone" && output === undefined ? undefined : eventSchema(type, props)],
          ]),
        );
    });
  }
  function resolve(source: State, target: string): State | undefined {
    let base: State | undefined, keys: string[];
    if (target.startsWith("#")) {
      const match = states
        .filter((s) => target === `#${s.id}` || target.startsWith(`#${s.id}.`))
        .sort((a, b) => b.id.length - a.id.length)[0];
      base = match;
      keys = match
        ? target
            .slice(match.id.length + 1)
            .split(".")
            .filter(Boolean)
        : [];
    } else if (target.startsWith(".")) {
      base = source;
      keys = target.slice(1).split(".");
    } else {
      base = source.parent ?? root;
      keys = target.split(".");
    }
    for (const key of keys) base = base?.children.find((s) => s.key === key);
    return base;
  }
  const routes = transitions.map((transition) => {
    const targets = list(transition.config["target"])
      .map((t) => (typeof t === "string" ? resolve(transition.source, t) : undefined))
      .filter((s): s is State => s !== undefined);
    if (!targets.length) return { transition, enters: [], exits: [] };
    let domain: State | undefined;
    if (
      transition.config["reenter"] !== true &&
      targets.every((t) => ancestor(transition.source, t))
    )
      domain = transition.source;
    else {
      domain = transition.source.parent;
      while (domain && !targets.every((t) => ancestor(domain!, t) && domain !== t))
        domain = domain.parent;
    }
    const exits = states.filter(
      (s) => (!domain || (s !== domain && ancestor(domain, s))) && compatible(transition.source, s),
    );
    const enters = new Set<State>();
    for (const target of targets) {
      for (const s of initial(target)) if (s !== domain) enters.add(s);
      let cursor = target === domain ? undefined : target.parent;
      while (cursor && cursor !== domain) {
        enters.add(cursor);
        cursor = cursor.parent;
      }
    }
    // Enter the other regions of each entered parallel state.
    for (const state of enters)
      if (state.config["type"] === "parallel") {
        for (const region of state.children)
          if (![...enters].some((s) => ancestor(region, s)))
            for (const s of initial(region)) enters.add(s);
      }
    return { transition, enters: [...enters], exits };
  });
  for (const state of initial(root))
    state.entry.set(
      "xstate.init",
      schemas.input === undefined
        ? undefined
        : eventSchema("xstate.init", { input: schemas.input }),
    );
  // Eventless transitions inherit their state's event set. Propagate to a fixed point.
  let changed = true;
  while (changed) {
    const size = states.reduce((n, s) => n + s.entry.size + s.exit.size + s.always.size, 0);
    for (const { transition, enters, exits } of routes) {
      for (const state of enters) union(state.entry, transition.events);
      for (const state of exits) union(state.exit, transition.events);
    }
    for (const state of states) {
      union(state.always, state.entry);
      for (const transition of transitions)
        if (ancestor(state, transition.source) || ancestor(transition.source, state))
          union(state.always, transition.events);
    }
    changed = size !== states.reduce((n, s) => n + s.entry.size + s.exit.size + s.always.size, 0);
  }
  const sites: ExpressionSite[] = [];
  function site(
    value: unknown,
    location: string,
    events: Events,
    allowed: readonly ExpressionKind[],
    outputSchema?: Schema,
  ) {
    const ref = record(value),
      params = record(ref["params"]);
    if (typeof ref["type"] !== "string" || !ref["type"].startsWith("expression.")) return;
    const kind = ref["type"] as ExpressionKind;
    const expression = typeof params["expression"] === "string" ? params["expression"] : "";
    const missing =
      ((kind === "expression.map" || kind === "expression.assign") &&
        (outputSchema === undefined || schemas.context === undefined)) ||
      (events.size > 0 &&
        ([...events.values()].some((s) => s === undefined) ||
          (kind !== "expression.match" && schemas.context === undefined)));
    sites.push({
      location,
      expression,
      kind,
      events: [...events]
        .sort(([a], [b]) => compareExpressionText(a, b))
        .map(([type, schema]) => ({ type, schema })),
      contextSchema: schemas.context,
      outputSchema,
      ...(!allowed.includes(kind)
        ? { problem: "site-unsupported" as const }
        : missing
          ? { problem: "schema-missing" as const }
          : {}),
    });
  }
  function actions(value: unknown, path: string, events: Events) {
    list(value).forEach((action, i) =>
      site(
        action,
        `${path}${Array.isArray(value) ? `/${i}` : ""}`,
        events,
        ["expression.assign"],
        schemas.context,
      ),
    );
  }
  for (const state of states) {
    actions(state.config["entry"], `${state.path}/entry`, state.entry);
    actions(state.config["exit"], `${state.path}/exit`, state.exit);
    site(
      state.config["output"],
      `${state.path}/output`,
      state.entry,
      state.parent === root && state.config["type"] === "final" ? ["expression.map"] : [],
      schemas.output,
    );
    list(state.config["invoke"]).forEach((value, i) => {
      const invoke = record(value);
      site(
        invoke["input"],
        `${state.path}/invoke${Array.isArray(state.config["invoke"]) ? `/${i}` : ""}/input`,
        state.entry,
        ["expression.map"],
        typeof invoke["src"] === "string" ? schemas.actors?.[invoke["src"]]?.input : undefined,
      );
    });
  }
  for (const transition of transitions) {
    site(transition.config["guard"], `${transition.path}/guard`, transition.events, [
      "expression.guard",
      "expression.match",
    ]);
    actions(transition.config["actions"], `${transition.path}/actions`, transition.events);
  }
  if (
    root.config["output"] !== undefined &&
    root.children.some((s) => s.config["type"] === "final" && s.config["output"] !== undefined) &&
    !sites.some((s) => s.location === "/output")
  ) {
    sites.push({
      location: "/output",
      expression: "",
      kind: "expression.map",
      events: [],
      contextSchema: schemas.context,
      outputSchema: schemas.output,
      problem: "site-unsupported",
    });
  }
  for (const [index, path] of (blueprint.migrations ?? []).entries())
    sites.push({
      location: `/migrations/${index}/context`,
      expression: path.context.params.expression,
      kind: "expression.map",
      events: [{ type: "migration", schema: true }],
      contextSchema: path.from,
      outputSchema: schemas.context,
      migration: true,
    });
  return sites.sort((a, b) => compareExpressionText(a.location, b.location));
}
