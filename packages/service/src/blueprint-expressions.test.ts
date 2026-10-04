// ---
// relationships:
//   verifies: blueprint-expressions
// ---
import { afterEach, describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { createActor, setup, fromPromise } from "xstate";
import {
  configureBlueprintExpressions,
  expressionsDefaults,
  createBlueprintExpressions,
} from "./blueprint-expressions.ts";
import type { ExpressionBlueprint, ExpressionError } from "@wyrd-company/manifold-shared";

const object = {
  type: "object",
  properties: { count: { type: "number" } },
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
      properties: { type: { const: "parcel.scan" }, count: { type: "number" } },
      required: ["type", "count"],
    },
  },
  actors: { prepare: { input: object, output: object } },
};
const yaml = `
id: parcel
initial: ready
context: { count: 0 }
states:
  ready:
    on:
      parcel.scan:
        guard: { type: expression.match, params: { expression: 'count > 0' } }
        actions: { type: expression.assign, params: { expression: '{"count": event.count}' } }
        target: preparing
  preparing:
    invoke:
      src: prepare
      id: preparation
      input: { type: expression.map, params: { expression: 'context' } }
      onDone:
        guard: { type: expression.guard, params: { expression: 'event.output.count = context.count' } }
        target: delivered
  delivered:
    type: final
    output: { type: expression.map, params: { expression: 'context' } }
`;

describe("blueprint expressions in XState", () => {
  it("runs all four YAML references and preserves the serialized blueprint", async () => {
    const blueprint: ExpressionBlueprint = { machine: parse(yaml), schemas };
    const original = JSON.stringify(blueprint);
    const errors: ExpressionError[] = [];
    const expressions = createBlueprintExpressions(blueprint, { onError: (e) => errors.push(e) });
    const logic = setup({
      guards: expressions.guards,
      actions: expressions.actions,
      actors: { prepare: fromPromise(async ({ input }) => input) },
    }).createMachine(expressions.machine);
    const actor = createActor(logic, { input: { count: 0 } });
    const done = new Promise<void>((resolve) =>
      actor.subscribe({
        complete: resolve,
        error: (error) => {
          throw error;
        },
      }),
    );
    actor.start();
    actor.send({ type: "parcel.scan", count: -1 });
    expect(actor.getSnapshot().value).toBe("ready");
    actor.send({ type: "parcel.scan", count: 4 });
    await done;
    expect(actor.getSnapshot().output).toEqual({ count: 4 });
    expect(errors).toEqual([]);
    expect(JSON.stringify(blueprint)).toBe(original);
    expect(JSON.parse(original)).toEqual(blueprint);
  });
  it("contains guard failures and atomically rejects invalid assignments with an error event", () => {
    const errors: ExpressionError[] = [];
    const machine = parse(`
initial: ready
context: { count: 2 }
states:
  ready:
    on:
      parcel.scan:
        - guard: { type: expression.guard, params: { expression: '$error("guard")' } }
          target: forbidden
        - actions: { type: expression.assign, params: { expression: '{"count": "invalid"}' } }
      expression.error: failed
  forbidden: {}
  failed: {}
`);
    const expressions = createBlueprintExpressions(
      { machine, schemas },
      { onError: (e) => errors.push(e) },
    );
    const actor = createActor(setup(expressions).createMachine(expressions.machine)).start();
    actor.send({ type: "parcel.scan", count: 4 });
    expect(actor.getSnapshot().value).toBe("failed");
    expect(actor.getSnapshot().context).toEqual({ count: 2 });
    expect(errors.map((e) => e.detail.kind)).toEqual(["evaluation", "schema"]);
    expect(errors[1]?.detail.location).toBe("/states/ready/on/parcel.scan/1/actions");
    actor.stop();
  });
  it.each(["left", "right"])(
    "forwards the %s final output through a real child and the parent onDone event",
    (target) => {
      const machine = {
        initial: "ready",
        context: { count: 2 },
        states: {
          ready: { on: { "parcel.scan": target } },
          left: {
            type: "final",
            output: { type: "expression.map", params: { expression: '{"count": 10}' } },
          },
          right: {
            type: "final",
            output: { type: "expression.map", params: { expression: '{"count": 20}' } },
          },
        },
      };
      const expressions = createBlueprintExpressions({ machine, schemas }, { onError: () => {} });
      const child = setup(expressions).createMachine(expressions.machine);
      let output: unknown;
      const parent = createActor(
        setup({ actors: { child } }).createMachine({
          initial: "active",
          context: {},
          states: {
            active: {
              invoke: {
                id: "child",
                src: "child",
                onDone: {
                  actions: ({ event }) => {
                    output = event.output;
                  },
                  target: "done",
                },
              },
            },
            done: { type: "final" },
          },
        }),
      ).start();
      const childActor = parent.getSnapshot().children["child"]!;
      childActor.send({ type: "parcel.scan", count: 1 });
      expect(childActor.getSnapshot().output).toEqual({ count: target === "left" ? 10 : 20 });
      expect(output).toEqual(childActor.getSnapshot().output);
      expect(parent.getSnapshot().status).toBe("done");
    },
  );
  it("throws syntax and missing-schema errors at load with the first location", () => {
    expect(() =>
      createBlueprintExpressions(
        {
          machine: {
            initial: "ready",
            states: {
              ready: { entry: { type: "expression.assign", params: { expression: ">" } } },
            },
          },
          schemas,
        },
        { onError: () => {} },
      ),
    ).toThrowError(/\/states\/ready\/entry/);
    expect(() =>
      createBlueprintExpressions(
        {
          machine: {
            initial: "ready",
            states: {
              ready: {
                invoke: {
                  src: "unknown",
                  input: { type: "expression.map", params: { expression: "$" } },
                },
              },
            },
          },
          schemas,
        },
        { onError: () => {} },
      ),
    ).toThrowError(/schema/);
  });
});

describe("expression failure and replay boundaries", () => {
  it.each(["expression.guard", "expression.match"])("does not pass a non-boolean %s", (type) => {
    const errors: ExpressionError[] = [];
    const machine = {
      initial: "ready",
      context: { count: 1 },
      states: {
        ready: {
          on: { "parcel.scan": { guard: { type, params: { expression: "42" } }, target: "done" } },
        },
        done: { type: "final" },
      },
    };
    const expressions = createBlueprintExpressions(
      { machine, schemas },
      { onError: (e) => errors.push(e) },
    );
    const actor = createActor(setup(expressions).createMachine(expressions.machine)).start();
    actor.send({ type: "parcel.scan" });
    expect(actor.getSnapshot().value).toBe("ready");
    expect(errors[0]?.detail).toMatchObject({
      kind: "result",
      expression: "42",
      location: "/states/ready/on/parcel.scan/guard",
    });
    actor.stop();
  });
  it.each(['$error("bad")', "42", "$sum", '{"count": 2, "value": $sum}'])(
    "preserves context and carries assignment failure detail for %s",
    (expression) => {
      const errors: ExpressionError[] = [];
      let eventError: unknown;
      const machine = {
        initial: "ready",
        context: { count: 1 },
        states: {
          ready: {
            on: {
              "parcel.scan": { actions: { type: "expression.assign", params: { expression } } },
              "expression.error": { actions: "capture" },
            },
          },
        },
      };
      const expressions = createBlueprintExpressions(
        { machine, schemas },
        { onError: (e) => errors.push(e) },
      );
      // Dynamic YAML is narrowed once, where it crosses into the typed XState setup.
      const configured = setup({
        ...expressions,
        actions: {
          ...expressions.actions,
          capture: ({ event }) => {
            eventError = event["error"];
          },
        },
      });
      const actor = createActor(configured.createMachine(expressions.machine)).start();
      actor.send({ type: "parcel.scan" });
      expect(actor.getSnapshot().context).toEqual({ count: 1 });
      expect(eventError).toEqual(errors[0]?.detail);
      expect(errors).toHaveLength(1);
      actor.stop();
    },
  );
  it.each(["input", "output"])(
    "stops an actor on a failing %s mapping and reports its location",
    (position) => {
      const errors: ExpressionError[] = [];
      const mapping = { type: "expression.map", params: { expression: '{"count": "bad"}' } };
      const machine =
        position === "input"
          ? {
              initial: "ready",
              context: { count: 1 },
              states: { ready: { invoke: { src: "prepare", input: mapping } } },
            }
          : {
              initial: "done",
              context: { count: 1 },
              states: { done: { type: "final", output: mapping } },
            };
      const expressions = createBlueprintExpressions(
        { machine, schemas },
        { onError: (e) => errors.push(e) },
      );
      const actor = createActor(
        setup({
          ...expressions,
          actors: { prepare: fromPromise(async ({ input }) => input) },
        }).createMachine(expressions.machine),
      );
      let failure: unknown;
      actor.subscribe({
        error: (e) => {
          failure = e;
        },
      });
      actor.start();
      expect(actor.getSnapshot().status).toBe("error");
      expect(failure).toBe(errors[0]);
      expect(errors[0]?.detail).toMatchObject({
        kind: "schema",
        location: position === "input" ? "/states/ready/invoke/input" : "/states/done/output",
      });
      actor.stop();
    },
  );
  it("works in initial, eventless and restored transitions with deterministic replay", () => {
    const machine = {
      initial: "ready",
      context: { count: 1 },
      states: {
        ready: {
          entry: {
            type: "expression.assign",
            params: { expression: '{"count": context.count + 1}' },
          },
          always: {
            guard: { type: "expression.guard", params: { expression: "context.count = 2" } },
            target: "waiting",
          },
        },
        waiting: {
          on: {
            "parcel.scan": {
              actions: {
                type: "expression.assign",
                params: { expression: '{"count": context.count + event.count}' },
              },
            },
          },
        },
      },
    };
    const expressions = createBlueprintExpressions(
      { machine, schemas },
      {
        onError: (e) => {
          throw e;
        },
      },
    );
    const logic = setup(expressions).createMachine(expressions.machine);
    const actor = createActor(logic).start();
    expect(actor.getSnapshot().value).toBe("waiting");
    const saved = actor.getPersistedSnapshot();
    actor.send({ type: "parcel.scan", count: 3 });
    const next = actor.getSnapshot().context;
    actor.stop();
    for (let i = 0; i < 2; i++) {
      const restored = createActor(logic, { snapshot: saved }).start();
      expect(restored.getSnapshot().context).toEqual({ count: 2 });
      restored.send({ type: "parcel.scan", count: 3 });
      expect(restored.getSnapshot().context).toEqual(next);
      restored.stop();
    }
  });
  it("keeps static root output and supports a final state without output", () => {
    for (const machine of [
      {
        initial: "done",
        context: { count: 1 },
        output: { count: 7 },
        states: { done: { type: "final" } },
      },
      {
        initial: "empty",
        context: { count: 1 },
        states: {
          empty: { type: "final" },
          mapped: {
            type: "final",
            output: { type: "expression.map", params: { expression: "context" } },
          },
        },
      },
    ]) {
      const expressions = createBlueprintExpressions(
        { machine, schemas },
        {
          onError: (e) => {
            throw e;
          },
        },
      );
      const actor = createActor(setup(expressions).createMachine(expressions.machine)).start();
      expect(actor.getSnapshot().output).toEqual("output" in machine ? { count: 7 } : undefined);
    }
  });
});

describe("worker expression reuse", () => {
  it("reports the current site for a source cached at another site", () => {
    const errors: ExpressionError[] = [];
    for (const name of ["first", "second"]) {
      const machine = {
        initial: name,
        context: { count: 1 },
        states: {
          [name]: {
            on: {
              "parcel.scan": {
                guard: {
                  type: "expression.guard",
                  params: { expression: '$error("same source")' },
                },
              },
            },
          },
        },
      };
      const expressions = createBlueprintExpressions(
        { machine, schemas },
        { onError: (error) => errors.push(error) },
      );
      const actor = createActor(setup(expressions).createMachine(expressions.machine)).start();
      actor.send({ type: "parcel.scan" });
      actor.stop();
    }
    expect(errors.map((error) => error.detail.location)).toEqual([
      "/states/first/on/parcel.scan/guard",
      "/states/second/on/parcel.scan/guard",
    ]);
  });
  it("keeps JSONata runtime clock functions unchanged", () => {
    const machine = {
      initial: "ready",
      context: { count: 1 },
      states: {
        ready: {
          on: {
            "parcel.scan": {
              guard: { type: "expression.guard", params: { expression: "$millis() > 0" } },
              target: "done",
            },
          },
        },
        done: { type: "final" },
      },
    };
    const expressions = createBlueprintExpressions(
      { machine, schemas },
      {
        onError: (error) => {
          throw error;
        },
      },
    );
    const actor = createActor(setup(expressions).createMachine(expressions.machine)).start();
    actor.send({ type: "parcel.scan" });
    expect(actor.getSnapshot().status).toBe("done");
  });
});

describe("worker wait contract", () => {
  afterEach(() => configureBlueprintExpressions());
  it.each([249, 60001, 250.5, NaN, Infinity])("rejects timeoutMs %s", (timeoutMs) => {
    expect(() => configureBlueprintExpressions({ timeoutMs })).toThrowError(/timeoutMs/);
  });
  it.each([250, 60000])("accepts timeoutMs boundary %s", (timeoutMs) => {
    expect(() => configureBlueprintExpressions({ timeoutMs })).not.toThrow();
  });
  it("bounds a recursive guard, reports the site, and recovers for the next evaluation", () => {
    const expression = "($again := function() { $again() }; event.count = 0 ? $again() : true)";
    const errors: ExpressionError[] = [];
    const machine = {
      initial: "ready",
      context: { count: 1 },
      states: {
        ready: {
          on: {
            "parcel.scan": {
              guard: { type: "expression.guard", params: { expression } },
              target: "done",
            },
          },
        },
        done: { type: "final" },
      },
    };
    const expressions = createBlueprintExpressions(
      { machine, schemas },
      { onError: (error) => errors.push(error) },
    );
    const actor = createActor(setup(expressions).createMachine(expressions.machine)).start();
    configureBlueprintExpressions({ timeoutMs: 250 });
    const start = performance.now();
    actor.send({ type: "parcel.scan", count: 0 });
    expect(performance.now() - start).toBeLessThan(1000);
    expect(actor.getSnapshot().value).toBe("ready");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.detail).toEqual({
      kind: "evaluation",
      expression,
      location: "/states/ready/on/parcel.scan/guard",
      message: "Expression did not finish within 250 ms; the expression worker was restarted",
    });
    // An empty section replaces the previous bound with the shipped default.
    configureBlueprintExpressions({});
    expect(expressionsDefaults).toEqual({ timeoutMs: 1000 });
    actor.send({ type: "parcel.scan", count: 0 });
    expect(errors).toHaveLength(2);
    expect(errors[1]?.detail.message).toBe(
      "Expression did not finish within 1000 ms; the expression worker was restarted",
    );
    actor.send({ type: "parcel.scan", count: 1 });
    expect(actor.getSnapshot().status).toBe("done");
    expect(errors).toHaveLength(2);
    actor.stop();
  });
});

describe("bounded evaluation follows the existing actor error paths", () => {
  afterEach(() => configureBlueprintExpressions());
  it.each(["match", "assign", "input", "output"])("contains a runaway %s", (site) => {
    configureBlueprintExpressions({ timeoutMs: 250 });
    const errors: ExpressionError[] = [];
    const reference = {
      type:
        site === "match"
          ? "expression.match"
          : site === "assign"
            ? "expression.assign"
            : "expression.map",
      params: { expression: "($again := function() { $again() }; $again())" },
    };
    const machine = {
      initial: "ready",
      context: { count: 1 },
      states: {
        ready:
          site === "output"
            ? { type: "final", output: reference }
            : site === "input"
              ? { invoke: { src: "prepare", input: reference } }
              : {
                  on: {
                    "parcel.scan":
                      site === "match"
                        ? { guard: reference, target: "forbidden" }
                        : { actions: reference },
                    "expression.error": "failed",
                  },
                },
        forbidden: {},
        failed: {},
      },
    };
    const expressions = createBlueprintExpressions(
      { machine, schemas },
      { onError: (error) => errors.push(error) },
    );
    const actor = createActor(
      setup({
        ...expressions,
        actors: { prepare: fromPromise(async ({ input }) => input) },
      }).createMachine(expressions.machine),
    );
    let failure: unknown;
    actor.subscribe({
      error: (error) => {
        failure = error;
      },
    });
    actor.start();
    if (site === "match" || site === "assign") actor.send({ type: "parcel.scan", count: 1 });
    expect(errors).toHaveLength(1);
    expect(errors[0]?.detail.kind).toBe("evaluation");
    expect(errors[0]?.detail.message).toContain("within 250 ms");
    expect(actor.getSnapshot().context).toEqual({ count: 1 });
    if (site === "match") expect(actor.getSnapshot().value).toBe("ready");
    else if (site === "assign") expect(actor.getSnapshot().value).toBe("failed");
    else {
      expect(actor.getSnapshot().status).toBe("error");
      expect(failure).toBe(errors[0]);
    }
    actor.stop();
  });
});
