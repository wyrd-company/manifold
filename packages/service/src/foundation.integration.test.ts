// ---
// relationships:
//   verifies: [store, portfolio-ledger, blueprint-expressions, decision-models]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { createActor, fromPromise, setup } from "xstate";
import { lintBlueprintExpressions, lintDecisionModel } from "@wyrd-company/manifold-shared";
import type { ExpressionBlueprint, ExpressionError } from "@wyrd-company/manifold-shared";
import { openStore } from "./store/index.ts";
import type { DeliveryTarget, Store } from "./store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "./ledger/index.ts";
import { createBlueprintExpressions, createDecisionModels } from "./index.ts";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});

describe("store and ledger on one database file", () => {
  const portfolio = parseLedgerPortfolio({
    items: [
      { id: "north", parent: null },
      { id: "south", parent: null },
    ],
    allocations: [
      { item: "north", account: "meter", guarantee: 60 },
      { item: "south", account: "meter", guarantee: 40 },
    ],
  });
  function open(path: string, probe?: (step: string) => void) {
    const store = openStore({ path, now: () => 10, ...(probe ? { probe } : {}) });
    store.connection.migrate("ledger", ledgerMigrationSteps);
    const ledger = createLedger({ connection: store.connection, portfolio, now: () => 10 });
    return { store, ledger };
  }
  function directory() {
    const dir = mkdtempSync(join(tmpdir(), "foundation-"));
    cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
    return join(dir, "manifold.sqlite");
  }
  // An actor whose send posts the event's amount as an actual, keyed by the event id.
  function meterActor(ledger: ReturnType<typeof open>["ledger"], store: Store): DeliveryTarget {
    const total = Number(store.loadSnapshot("meter-01")?.snapshot["context"] ?? 0);
    let next = total;
    return {
      actorId: "meter-01",
      send(row) {
        const amount = (row.payload as { amount: number }).amount;
        ledger.postActual({
          key: `actual:${row.eventId}`,
          actor: "meter-01",
          item: "north",
          account: "meter",
          amount,
          usedAt: 10,
        });
        next += amount;
      },
      persist: () => ({
        machine: "meter",
        snapshot: { status: "active", value: "running", context: next },
      }),
    };
  }

  it("migrates both owners once and keeps both after a reopen", () => {
    const path = directory();
    const first = open(path);
    first.ledger.credit({
      key: "credit-1",
      account: "meter",
      window: "w1",
      opensAt: 0,
      closesAt: 1000,
      amount: 100,
    });
    first.ledger.reserve({
      key: "hold-1",
      actor: "meter-01",
      item: "north",
      account: "meter",
      amount: 30,
    });
    first.store.saveSnapshot({
      actorId: "meter-01",
      machine: "meter",
      snapshot: { status: "active", value: "running", context: 0 },
    });
    first.store.close();

    const second = open(path);
    const versions = second.store.connection.database
      .prepare("SELECT owner, version FROM schema_migration ORDER BY owner")
      .all();
    expect(versions.map((row) => row["owner"])).toEqual(["ledger", "store"]);
    expect(second.store.findActorsInState({ machine: "meter", statePath: "running" })).toHaveLength(
      1,
    );
    expect(second.ledger.balance({ item: "north", account: "meter", waiting: [] })).toMatchObject({
      allocation: 60,
      outstanding: 30,
      available: 30,
    });
    second.store.close();
  });

  it("rolls back a ledger write and a snapshot together in one store transaction", () => {
    const { store, ledger } = open(directory());
    ledger.credit({
      key: "credit-1",
      account: "meter",
      window: "w1",
      opensAt: 0,
      closesAt: 1000,
      amount: 100,
    });
    expect(() =>
      store.connection.transaction(() => {
        ledger.reserve({
          key: "hold-1",
          actor: "meter-01",
          item: "south",
          account: "meter",
          amount: 20,
        });
        store.saveSnapshot({
          actorId: "meter-01",
          machine: "meter",
          snapshot: { status: "active", value: "holding", context: 0 },
        });
        throw new Error("crash");
      }),
    ).toThrow("crash");
    expect(store.loadSnapshot("meter-01")).toBeUndefined();
    expect(ledger.balance({ item: "south", account: "meter", waiting: [] }).outstanding).toBe(0);
    store.close();
  });

  it("posts an actual once when a delivery crashes after send and replays on a fresh store", () => {
    const path = directory();
    const setupStore = open(path);
    setupStore.ledger.credit({
      key: "credit-1",
      account: "meter",
      window: "w1",
      opensAt: 0,
      closesAt: 1000,
      amount: 100,
    });
    setupStore.store.writeInbox({ eventId: "e-1", topic: "meter.read", payload: { amount: 7 } }, [
      "meter-01",
    ]);
    setupStore.store.close();

    const crashing = open(path, (step) => {
      if (step === "sent") throw new Error("crash");
    });
    expect(() => crashing.store.drain(meterActor(crashing.ledger, crashing.store))).toThrow(
      "crash",
    );
    crashing.store.close();

    const restarted = open(path);
    expect(restarted.store.drain(meterActor(restarted.ledger, restarted.store))).toEqual({
      delivered: 1,
      erroredAt: undefined,
    });
    expect(restarted.store.loadSnapshot("meter-01")?.snapshot["context"]).toBe(7);
    expect(restarted.ledger.actorUsage("meter-01").accounts).toEqual([
      expect.objectContaining({ account: "meter", actual: 7 }),
    ]);
    expect(
      restarted.ledger.balance({ item: "north", account: "meter", waiting: [] }),
    ).toMatchObject({ actual: 7, available: 53 });
    restarted.store.close();
  });
});

describe("decision models with blueprint expressions", () => {
  const model = parse(`
nodes:
  - { id: input, type: inputNode }
  - id: classify
    type: customNode
    content:
      kind: jsonataDecisionTable
      config:
        hitPolicy: first
        inputs: [{ id: celsius, field: reading.celsius }]
        outputs: [{ id: mode, field: result.mode }]
        rules:
          - { _id: hot, celsius: "$ >= 100", mode: '"boil"' }
          - { _id: rest, mode: '"warm"' }
  - { id: output, type: outputNode }
edges:
  - { id: a, sourceId: input, targetId: classify }
  - { id: b, sourceId: classify, targetId: output }
`);
  const reading = {
    type: "object",
    properties: { celsius: { type: "number" }, mode: { type: "string" } },
    required: ["celsius", "mode"],
    additionalProperties: false,
  };
  const blueprint: ExpressionBlueprint = {
    machine: parse(`
id: kettle
initial: idle
context: { celsius: 0, mode: none }
states:
  idle:
    on:
      kettle.read:
        guard: { type: expression.match, params: { expression: 'celsius >= 0' } }
        actions: { type: expression.assign, params: { expression: '{"celsius": event.celsius}' } }
        target: deciding
  deciding:
    invoke:
      src: decide
      id: decision
      input: { type: expression.map, params: { expression: '{"reading": {"celsius": context.celsius}}' } }
      onDone:
        - guard: { type: expression.guard, params: { expression: 'event.output.result.mode = "boil"' } }
          actions: { type: expression.assign, params: { expression: '{"mode": event.output.result.mode}' } }
          target: boiling
        - actions: { type: expression.assign, params: { expression: '{"mode": event.output.result.mode}' } }
          target: warming
  boiling:
    type: final
    output: { type: expression.map, params: { expression: 'context' } }
  warming:
    type: final
    output: { type: expression.map, params: { expression: 'context' } }
`),
    schemas: {
      input: reading,
      context: reading,
      output: reading,
      events: {
        "kettle.read": {
          type: "object",
          properties: { type: { const: "kettle.read" }, celsius: { type: "number" } },
          required: ["type", "celsius"],
        },
      },
      actors: {
        decide: {
          input: {
            type: "object",
            properties: {
              reading: {
                type: "object",
                properties: { celsius: { type: "number" } },
                required: ["celsius"],
              },
            },
            required: ["reading"],
          },
          output: {
            type: "object",
            properties: {
              result: {
                type: "object",
                properties: { mode: { type: "string", enum: ["boil", "warm"] } },
                required: ["mode"],
              },
            },
            required: ["result"],
          },
        },
      },
    },
  };

  it("lints the model and the blueprint that invokes it clean", async () => {
    expect(lintDecisionModel(model, "kettle")).toEqual([]);
    expect(await lintBlueprintExpressions(blueprint)).toEqual([]);
  });

  it.each([
    [120, "boiling", "boil"],
    [40, "warming", "warm"],
  ])("routes a reading of %i through the decision model to %s", async (celsius, state, mode) => {
    const models = createDecisionModels({ kettle: model });
    cleanup.push(() => models.dispose());
    const errors: ExpressionError[] = [];
    const expressions = createBlueprintExpressions(blueprint, {
      onError: (error) => errors.push(error),
    });
    const logic = setup({
      guards: expressions.guards,
      actions: expressions.actions,
      actors: {
        decide: fromPromise(async ({ input }: { input: Record<string, unknown> }) => {
          const evaluation = await models.evaluate("kettle", input);
          if (evaluation.outcome === "error") throw new Error(evaluation.error.message);
          return evaluation.result;
        }),
      },
    }).createMachine(expressions.machine);
    const actor = createActor(logic, { input: { celsius: 0, mode: "none" } });
    const done = new Promise<void>((resolve, reject) =>
      actor.subscribe({ complete: resolve, error: reject }),
    );
    actor.start();
    actor.send({ type: "kettle.read", celsius: -5 });
    expect(actor.getSnapshot().value).toBe("idle");
    actor.send({ type: "kettle.read", celsius });
    await done;
    expect(actor.getSnapshot().value).toBe(state);
    expect(actor.getSnapshot().output).toEqual({ celsius, mode });
    expect(errors).toEqual([]);
  });

  it("stops the invoking actor with the failing cell named when a decision model throws", async () => {
    const broken = structuredClone(model);
    broken.nodes[1].content.config.rules[0].celsius = "$missing($)";
    const models = createDecisionModels({ kettle: broken });
    cleanup.push(() => models.dispose());
    const expressions = createBlueprintExpressions(blueprint, { onError: () => {} });
    let failure: unknown;
    const logic = setup({
      guards: expressions.guards,
      actions: expressions.actions,
      actors: {
        decide: fromPromise(async ({ input }: { input: Record<string, unknown> }) => {
          const evaluation = await models.evaluate("kettle", input);
          if (evaluation.outcome === "error") failure = evaluation.error;
          if (evaluation.outcome === "error") throw new Error(evaluation.error.message);
          return evaluation.result;
        }),
      },
    }).createMachine(expressions.machine);
    const actor = createActor(logic, { input: { celsius: 0, mode: "none" } });
    const stopped = new Promise<void>((resolve) =>
      actor.subscribe({ complete: () => resolve(), error: () => resolve() }),
    );
    actor.start();
    actor.send({ type: "kettle.read", celsius: 120 });
    await stopped;
    expect(actor.getSnapshot().status).toBe("error");
    expect(failure).toMatchObject({
      kind: "evaluation",
      model: "kettle",
      nodeId: "classify",
      ruleId: "hot",
      columnId: "celsius",
    });
  });
});
