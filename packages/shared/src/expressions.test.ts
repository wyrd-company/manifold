// ---
// relationships:
//   verifies: blueprint-expressions
// ---
import { describe, expect, it } from "vite-plus/test";
import { compileExpression, evaluateExpression, ExpressionError } from "./expressions.ts";

describe("JSONata primitive", () => {
  it("shares input and bindings without retaining them between calls", async () => {
    const expression = compileExpression("$ + $offset", "/cell");
    expect(await evaluateExpression(expression, 4, { offset: 2 })).toBe(6);
    expect(await evaluateExpression(expression, 4, { offset: 7 })).toBe(11);
  });
  it("names syntax and evaluation errors with source and location", async () => {
    expect(() => compileExpression(">", "/cell")).toThrow(ExpressionError);
    try {
      compileExpression(">", "/cell");
    } catch (error) {
      expect((error as ExpressionError).detail).toMatchObject({
        kind: "syntax",
        location: "/cell",
        expression: ">",
        code: "S0211",
      });
    }
    await expect(
      evaluateExpression(compileExpression('$error("bad")', "/cell"), {}),
    ).rejects.toMatchObject({
      detail: { kind: "evaluation", location: "/cell", expression: '$error("bad")' },
    });
  });
});

import { collectExpressionSites, lintBlueprintExpressions } from "./blueprint-expressions.ts";
const ref = (type: string, expression: string) => ({ type, params: { expression } });
const object = {
  type: "object",
  properties: { count: { type: "number", default: 2 } },
  required: ["count"],
  additionalProperties: false,
};
const schemas = {
  input: object,
  context: object,
  output: object,
  events: {
    "parcel.scan": {
      type: "object",
      properties: { type: { const: "parcel.scan" }, count: { type: "number", default: 3 } },
      required: ["type", "count"],
    },
  },
};
const machine = (expression: string, type = "expression.assign") => ({
  initial: "ready",
  context: { count: 2 },
  states: { ready: { on: { "parcel.scan": { actions: ref(type, expression) } } } },
});

describe("blueprint expression lint", () => {
  it("validates assignments and reports each failing sample at its pointer", async () => {
    expect(
      await lintBlueprintExpressions({ machine: machine('{"count": event.count}'), schemas }),
    ).toEqual([]);
    const findings = await lintBlueprintExpressions({
      machine: machine('{"count": "wrong"}'),
      schemas,
    });
    expect(findings).toHaveLength(4);
    expect(findings[0]).toMatchObject({
      kind: "schema",
      location: "/states/ready/on/parcel.scan/actions",
      sample: "full",
      eventType: "parcel.scan",
    });
  });
  it("checks boolean, syntax, missing schemas, and unsupported output sites", async () => {
    const config = {
      initial: "ready",
      states: {
        ready: {
          output: ref("expression.map", "$"),
          on: { "parcel.scan": { guard: ref("expression.guard", "42") } },
          invoke: { src: "worker", input: ref("expression.map", "$") },
        },
      },
    };
    const findings = await lintBlueprintExpressions({ machine: config, schemas });
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "result", location: "/states/ready/on/parcel.scan/guard" }),
        expect.objectContaining({ kind: "schema-missing", location: "/states/ready/invoke/input" }),
        expect.objectContaining({ kind: "site-unsupported", location: "/states/ready/output" }),
      ]),
    );
    expect(await lintBlueprintExpressions({ machine: machine(">"), schemas })).toMatchObject([
      { kind: "syntax", location: "/states/ready/on/parcel.scan/actions" },
    ]);
  });
  it("fixes clock and random per site and sample", async () => {
    const config = {
      initial: "ready",
      states: {
        ready: {
          on: {
            "parcel.scan": {
              guard: ref("expression.guard", "$string([$random(), $now(), $millis()])"),
            },
          },
        },
      },
    };
    const a = await lintBlueprintExpressions({ machine: config, schemas });
    expect(a.length).toBeGreaterThan(0);
    expect(await lintBlueprintExpressions({ machine: config, schemas })).toEqual(a);
  });
  it("derives invoke completion, snapshot, error and wildcard event sets", () => {
    const config = {
      initial: "waiting",
      states: {
        waiting: {
          invoke: {
            id: "delivery",
            src: "worker",
            onDone: "finished",
            onSnapshot: { guard: ref("expression.guard", "true") },
          },
          on: { "expression.error": "failed", "*": { actions: ref("expression.assign", "{}") } },
        },
        finished: { entry: ref("expression.assign", '{"count": event.output.count}') },
        failed: {
          entry: ref("expression.assign", "{}"),
          on: { "expression.error": { guard: ref("expression.match", "true") } },
        },
      },
    };
    const sites = collectExpressionSites({
      machine: config,
      schemas: { ...schemas, actors: { worker: { input: object, output: object } } },
    });
    expect(
      sites.find((s) => s.location === "/states/finished/entry")?.events.map((e) => e.type),
    ).toEqual(["xstate.done.actor.delivery"]);
    expect(
      sites.find((s) => s.location.endsWith("onSnapshot/guard"))?.events.map((e) => e.type),
    ).toEqual(["xstate.snapshot.delivery"]);
    expect(
      sites.find((s) => s.location === "/states/failed/entry")?.events.map((e) => e.type),
    ).toEqual(["expression.error"]);
    expect(
      sites.find((s) => s.location.includes("/on/*/actions"))?.events.map((e) => e.type),
    ).toEqual(["expression.error", "parcel.scan"]);
  });
  it("distinguishes reentered self transitions from internal self transitions", () => {
    for (const reenter of [false, true]) {
      const config = {
        initial: "ready",
        states: {
          ready: {
            entry: ref("expression.assign", "{}"),
            exit: ref("expression.assign", "{}"),
            on: { "parcel.scan": { target: "ready", reenter } },
          },
        },
      };
      const sites = collectExpressionSites({ machine: config, schemas });
      expect(sites.find((s) => s.location.endsWith("/entry"))?.events.map((e) => e.type)).toEqual(
        reenter ? ["parcel.scan", "xstate.init"] : ["xstate.init"],
      );
      expect(sites.find((s) => s.location.endsWith("/exit"))?.events.map((e) => e.type)).toEqual(
        reenter ? ["parcel.scan"] : [],
      );
    }
  });
});

describe("schema boundary and event topology regressions", () => {
  it("lints child input and final output mappings against the declared result schema", async () => {
    const config = {
      initial: "ready",
      states: {
        ready: {
          invoke: {
            id: "prep",
            src: "worker",
            input: ref("expression.map", '{"count": context.count}'),
            onDone: "finished",
          },
        },
        finished: { type: "final", output: ref("expression.map", "event.output") },
      },
    };
    const blueprint = {
      machine: config,
      schemas: { ...schemas, actors: { worker: { input: object, output: object } } },
    };
    expect(await lintBlueprintExpressions(blueprint)).toEqual([]);
    config.states.finished.output.params.expression = '{"count": "bad"}';
    expect(await lintBlueprintExpressions(blueprint)).toMatchObject([
      { kind: "schema", location: "/states/finished/output", sample: "full" },
      { kind: "schema", location: "/states/finished/output", sample: "full" },
      { kind: "schema", location: "/states/finished/output", sample: "full" },
      { kind: "schema", location: "/states/finished/output", sample: "required" },
    ]);
  });
  it("reports missing schemas even for unreachable mapping sites", async () => {
    const config = {
      initial: "ready",
      states: {
        ready: {},
        unreachable: { invoke: { src: "missing", input: ref("expression.map", "$") } },
      },
    };
    expect(await lintBlueprintExpressions({ machine: config, schemas })).toMatchObject([
      { kind: "schema-missing", location: "/states/unreachable/invoke/input" },
    ]);
  });
  it("supports initial transition objects and parallel initial configurations", () => {
    const config = {
      type: "parallel",
      states: {
        first: {
          initial: { target: "ready" },
          states: { ready: { entry: ref("expression.assign", "{}") } },
        },
        second: { initial: "ready", states: { ready: { entry: ref("expression.assign", "{}") } } },
      },
    };
    expect(
      collectExpressionSites({ machine: config, schemas }).map((s) => s.events.map((e) => e.type)),
    ).toEqual([["xstate.init"], ["xstate.init"]]);
  });
  it("uses examples, optional fields, required fields and fixed clock bindings", async () => {
    const context = {
      type: "object",
      properties: {
        count: { type: "number", default: 2 },
        optional: { type: "number", default: 7 },
      },
      required: ["count"],
      examples: [{ count: 9 }],
    };
    const config = {
      initial: "ready",
      states: {
        ready: {
          on: {
            "parcel.scan": {
              guard: ref(
                "expression.guard",
                'context.count = 9 ? "example" : $exists(context.optional) ? "full" : true',
              ),
            },
          },
        },
      },
    };
    const findings = await lintBlueprintExpressions({
      machine: config,
      schemas: { ...schemas, context },
    });
    expect(findings.filter((f) => f.sample === "examples[0]")).toHaveLength(2);
    expect(findings.filter((f) => f.sample === "required")).toEqual([]);
    expect(findings.filter((f) => f.sample === "full")).toHaveLength(2);
    const fixed = {
      initial: "ready",
      states: {
        ready: {
          on: {
            "parcel.scan": {
              guard: ref(
                "expression.guard",
                '($millis() = 0 and $now() = "1970-01-01T00:00:00.000Z" and $now("[Y0001]", "+0000") = "1970") ? true : "invalid clock"',
              ),
            },
          },
        },
      },
    };
    expect(await lintBlueprintExpressions({ machine: fixed, schemas })).toEqual([]);
  });
  it("reports evaluation and function-result errors without evaluating unreachable sites", async () => {
    expect(await lintBlueprintExpressions({ machine: machine('$error("bad")'), schemas })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "evaluation", eventType: "parcel.scan" }),
      ]),
    );
    expect(await lintBlueprintExpressions({ machine: machine("$sum"), schemas })).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "result" })]),
    );
    const config = {
      initial: "ready",
      states: {
        ready: {},
        unreachable: { entry: ref("expression.assign", '$error("unreachable")') },
      },
    };
    expect(await lintBlueprintExpressions({ machine: config, schemas })).toEqual([]);
  });
  it("rejects competing root output and nested output mappings", async () => {
    const config = {
      output: { count: 1 },
      initial: "ready",
      states: {
        ready: { on: { "parcel.scan": "done" } },
        done: { type: "final", output: ref("expression.map", '{"count": context.count}') },
      },
    };
    expect(await lintBlueprintExpressions({ machine: config, schemas })).toMatchObject([
      { kind: "site-unsupported", location: "/output" },
    ]);
  });
  it("handles arrays, pointer escapes, delay and eventless propagation", () => {
    const config = {
      id: "parcel",
      initial: "ready",
      states: {
        ready: {
          on: {
            "scan/~": [
              {
                guard: ref("expression.match", "true"),
                actions: [ref("expression.assign", "{}")],
                target: "waiting",
              },
            ],
          },
        },
        waiting: {
          after: { later: { guard: ref("expression.guard", "true"), target: "done" } },
          always: { guard: ref("expression.guard", "false"), target: "done" },
        },
        done: { entry: ref("expression.assign", "{}") },
      },
    };
    const sites = collectExpressionSites({
      machine: config,
      schemas: { ...schemas, events: { "scan/~": true } },
    });
    expect(sites.some((s) => s.location === "/states/ready/on/scan~1~0/0/actions/0")).toBe(true);
    expect(
      sites.find((s) => s.location.endsWith("after/later/guard"))?.events.map((e) => e.type),
    ).toEqual(["xstate.after.later.parcel.waiting"]);
    expect(
      sites.find((s) => s.location === "/states/done/entry")?.events.map((e) => e.type),
    ).toEqual(["scan/~", "xstate.after.later.parcel.waiting"]);
  });
});

describe("transferable expression results", () => {
  it("rejects nested function values as result errors", async () => {
    const findings = await lintBlueprintExpressions({
      machine: machine('{"value": $sum}'),
      schemas: { ...schemas, context: { type: "object" } },
    });
    expect(findings).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "result" })]));
  });
});

describe("transition entry boundaries", () => {
  it("does not enter ancestors of the domain for an internal self transition", () => {
    const config = {
      initial: "ready",
      entry: ref("expression.assign", "{}"),
      states: { ready: { on: { "parcel.scan": { target: "ready" } } } },
    };
    expect(
      collectExpressionSites({ machine: config, schemas })[0]?.events.map((e) => e.type),
    ).toEqual(["xstate.init"]);
  });
  it("does not propagate a disabled transition as an event that reaches an always site", () => {
    const config = {
      initial: "ready",
      states: {
        ready: {
          on: { "parcel.scan": undefined },
          always: { guard: ref("expression.guard", "true") },
        },
      },
    };
    expect(
      collectExpressionSites({ machine: config, schemas })[0]?.events.map((e) => e.type),
    ).toEqual(["xstate.init"]);
  });
});

describe("XState identities", () => {
  it("uses machine paths for implicit state and invoke ids under a custom parent id", () => {
    const config = {
      id: "parcel",
      initial: "outer",
      states: {
        outer: {
          id: "sorting",
          initial: "ready",
          states: {
            ready: {
              after: { later: { guard: ref("expression.guard", "true") } },
              invoke: { src: "worker", onSnapshot: { guard: ref("expression.guard", "true") } },
            },
          },
        },
      },
    };
    const sites = collectExpressionSites({ machine: config, schemas });
    expect(sites.map((s) => s.events.map((e) => e.type))).toEqual([
      ["xstate.after.later.parcel.outer.ready"],
      ["xstate.snapshot.0.parcel.outer.ready"],
    ]);
  });
});

describe("lint purity", () => {
  it("orders locations by code point regardless of the host locale", async () => {
    const config = {
      initial: "z",
      states: {
        z: { on: { "parcel.scan": { guard: ref("expression.guard", "42") } } },
        ä: { on: { "parcel.scan": { guard: ref("expression.guard", "42") } } },
      },
    };
    const findings = await lintBlueprintExpressions({ machine: config, schemas });
    expect(findings[0]?.location).toBe("/states/z/on/parcel.scan/guard");
  });
});

describe("service error event samples", () => {
  it("lints error handlers and wildcard actions against the built-in error event", async () => {
    const config = {
      initial: "ready",
      states: {
        ready: {
          on: {
            "expression.error": {
              guard: ref("expression.guard", "$exists(event.error.kind)"),
              actions: ref("expression.assign", "{}"),
              target: "failed",
            },
            "*": { actions: ref("expression.assign", "{}") },
          },
        },
        failed: { entry: ref("expression.assign", "{}") },
      },
    };
    expect(await lintBlueprintExpressions({ machine: config, schemas })).toEqual([]);
    config.states.ready.on["expression.error"].guard.params.expression = "event.error.kind";
    const findings = await lintBlueprintExpressions({ machine: config, schemas });
    expect(findings).toHaveLength(4);
    expect(findings.every((f) => f.kind === "result" && f.eventType === "expression.error")).toBe(
      true,
    );
  });
});

describe("decision-model compile seam", () => {
  it("keeps the JSONata syntax tree reachable through the public compiled expression type", async () => {
    const { compileExpression: compile } = await import("./index.ts");
    const compiled = compile("$ > 3", "/rule/cell");
    expect(compiled.expression.ast()).toMatchObject({
      type: "binary",
      value: ">",
      rhs: { type: "number", value: 3 },
    });
  });
});

describe("seeded lint random", () => {
  it("reproduces each site and sample stream independently of other evaluations", async () => {
    const guard = ref("expression.guard", '$random() < 0.5 ? true : "random sample"');
    const config = { initial: "ready", states: { ready: { on: { "parcel.scan": { guard } } } } };
    const first = await lintBlueprintExpressions({ machine: config, schemas });
    expect(first.map((f) => f.sample)).toEqual(["full", "required"]);
    await lintBlueprintExpressions({ machine: machine("$random()"), schemas });
    expect(await lintBlueprintExpressions({ machine: config, schemas })).toEqual(first);
  });
});

describe("assignment result shape", () => {
  it.each(["42", "null", "[]", '"text"'])(
    "rejects a non-object assignment result: %s",
    (expression) => {
      return expect(
        lintBlueprintExpressions({ machine: machine(expression), schemas }),
      ).resolves.toMatchObject([
        { kind: "result" },
        { kind: "result" },
        { kind: "result" },
        { kind: "result" },
      ]);
    },
  );
});

it("keeps an event schema's reference to its context schema when compiling a result", async () => {
  const { compileExpressionResult } = await import("./expression-results.ts");
  const check = compileExpressionResult({
    kind: "expression.guard",
    location: "/guard",
    expression: "true",
    contextSchema: { $id: "https://example.invalid/context", type: "object" },
    outputSchema: undefined,
    events: [{ type: "sample", schema: { $ref: "https://example.invalid/context" } }],
  });
  expect(check(true, {})).toBe(true);
});

it("rejects identity assignments and permits identity beside a closed context schema", async () => {
  expect(
    await lintBlueprintExpressions({ machine: machine('{"manifold": {}}'), schemas }),
  ).toMatchObject([{ kind: "result" }, { kind: "result" }, { kind: "result" }, { kind: "result" }]);
  const blueprint = { machine: machine('{"count": event.count}'), schemas };
  const site = collectExpressionSites(blueprint)[0]!;
  const { compileExpressionResult } = await import("./expression-results.ts");
  expect(
    compileExpressionResult(site)({ count: 4 }, { count: 2, manifold: { issue: "parcel" } }),
  ).toEqual({ count: 4, manifold: { issue: "parcel" } });
});

it("samples identity as present with fields and present with no fields", async () => {
  const blueprint = {
    machine: {
      initial: "ready",
      states: {
        ready: {
          invoke: {
            src: "courier",
            input: ref("expression.map", '{"node": context.manifold.issue}'),
          },
        },
      },
    },
    schemas: {
      ...schemas,
      actors: {
        courier: {
          input: { type: "object", required: ["node"], properties: { node: { type: "string" } } },
        },
      },
    },
  };
  const findings = await lintBlueprintExpressions(blueprint);
  expect(findings).toEqual([
    expect.objectContaining({ kind: "schema", sample: "full" }),
    expect.objectContaining({ kind: "schema", sample: "required" }),
  ]);
});
