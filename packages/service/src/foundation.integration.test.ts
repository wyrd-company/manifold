// ---
// relationships:
//   verifies: [store, portfolio-ledger, blueprint-expressions, decision-models, process-repository, blueprint-loader, portfolio, durable-event-delivery, github-event-source, t3code-environment-source]
// ---
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { parse, stringify } from "yaml";
import { fork, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import * as fs from "node:fs/promises";
import git from "isomorphic-git";
import { fixture as repositoryFixture } from "./process-repository/test-fixtures/remote.ts";
import { githubFake } from "./github-source/test-fixtures/api.ts";
import { fakeServer, fixtureThread } from "./t3code-source/test-fixtures/server.ts";
import { openPortfolio } from "./portfolio/index.ts";
import { blueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { FoundationWorkerConfiguration } from "./test-fixtures/foundation-worker.ts";
import { createActor, fromPromise, setup } from "xstate";
import { lintBlueprintExpressions, lintDecisionModel } from "@wyrd-company/manifold-shared";
import type { ExpressionBlueprint, ExpressionError } from "@wyrd-company/manifold-shared";
import { openStore } from "./store/index.ts";
import type { DeliveryTarget, Store } from "./store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "./ledger/index.ts";
import { createBlueprintExpressions, createDecisionModels } from "./index.ts";

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
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
    output: { type: expression.map, params: { expression: '$sift(context, function($value, $key) { $key != "manifold" })' } }
  warming:
    type: final
    output: { type: expression.map, params: { expression: '$sift(context, function($value, $key) { $key != "manifold" })' } }
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

it("resumes the same revision after SIGKILL across repository, sources, inbox and ledger", async () => {
  const directory = mkdtempSync(join(tmpdir(), "foundation-wave-two-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  const remote = await repositoryFixture(directory);
  cleanup.push(() => remote.close());
  const api = await githubFake();
  cleanup.push(() => api.close());
  api.addItem("item-one", "I_A");
  const server = await fakeServer();
  cleanup.push(() => server.close());
  const thread = fixtureThread();
  thread.session = {
    threadId: thread.id,
    status: "running",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: null,
    updatedAt: thread.createdAt,
  };
  server.baseline(thread);
  const token = join(directory, "token");
  const secretFile = join(directory, "hook-secret");
  writeFileSync(token, "fixture-token");
  writeFileSync(secretFile, "synthetic-secret");

  // A real git revision holds both declarations. Advance the live revision before restart.
  async function commit(state: string, parent?: string) {
    const eventTypes = ["github.issue.closed", "t3.turn.started"];
    const blueprint = {
      machine: {
        id: "oven",
        initial: state,
        context: { readings: [], count: 0 },
        states: {
          finished: { type: "final" },
          [state]: {
            on: Object.fromEntries(
              eventTypes.map((type) => [
                type,
                {
                  actions: {
                    type: "expression.assign",
                    params: {
                      expression:
                        '{"readings": $append(context.readings, event.type), "count": context.count + 1}',
                    },
                  },
                },
              ]),
            ),
          },
        },
      },
      schemas: {
        input: true,
        output: true,
        context: {
          type: "object",
          properties: {
            readings: { type: "array", items: { type: "string" } },
            count: { type: "number" },
          },
          required: ["readings", "count"],
          additionalProperties: false,
        },
        events: Object.fromEntries(eventTypes.map((type) => [type, true])),
      },
    };
    async function blob(path: string, value: unknown) {
      return {
        path,
        mode: "100644",
        type: "blob" as const,
        oid: await git.writeBlob({
          fs,
          gitdir: remote.gitdir,
          blob: Buffer.from(stringify(value)),
        }),
      };
    }
    const blueprints = await git.writeTree({
      fs,
      gitdir: remote.gitdir,
      tree: [await blob("oven.yml", blueprint)],
    });
    const tree = await git.writeTree({
      fs,
      gitdir: remote.gitdir,
      tree: [
        { path: "blueprints", mode: "040000", type: "tree", oid: blueprints },
        await blob("portfolio.yml", {
          items: {
            baking: { allocations: { meter: { guarantee: 60 } } },
            roasting: { allocations: { meter: { guarantee: 40 } } },
          },
        }),
        await blob("bindings.yml", {
          githubProjects: {
            recipes: {
              owner: "sample",
              number: 1,
              environment: "station",
              item: "baking",
              t3codeProjects: ["project"],
            },
          },
        }),
      ],
    });
    const author = {
      name: "Example",
      email: "example@example.test",
      timestamp: 1700000000,
      timezoneOffset: 0,
    };
    const oid = await git.writeCommit({
      fs,
      gitdir: remote.gitdir,
      commit: {
        message: "Recipe configuration",
        tree,
        parent: parent ? [parent] : [],
        author,
        committer: author,
      },
    });
    await remote.force(oid);
    return oid;
  }
  const original = await commit("warming");
  const configuration: FoundationWorkerConfiguration = {
    path: join(directory, "store.sqlite"),
    repository: {
      url: remote.url,
      branch: "main",
      directory: join(directory, "clone"),
      credential: undefined,
      pullTimeoutMs: 30000,
    },
    github: {
      apiUrl: api.url,
      owners: {
        sample: { credential: "api-reader", hooks: [{ id: 1, repository: undefined, secretFile }] },
      },
      sweepIntervalMs: 900000,
      redeliveryIntervalMs: 60000,
      requestTimeoutMs: 30000,
    },
    environments: {
      station: {
        url: server.url,
        credential: "reader",
        reconnect: { initialMs: 10, factor: 2, maxMs: 30, jitter: 0 },
        heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
        openTimeoutMs: 10000,
      },
    },
    token,
    crash: true,
  };
  // Compile the child with the shipping settings, including relative-import rewriting.
  const compiled = join(directory, "compiled");
  const buildConfiguration = join(directory, "tsconfig.json");
  const serviceRoot = fileURLToPath(new URL("..", import.meta.url));
  writeFileSync(
    buildConfiguration,
    JSON.stringify({
      extends: join(serviceRoot, "tsconfig.build.json"),
      compilerOptions: {
        outDir: compiled,
        declaration: false,
        typeRoots: [join(serviceRoot, "node_modules/@types")],
      },
      include: [join(serviceRoot, "src/**/*.ts")],
      exclude: [
        join(serviceRoot, "src/**/*.test.ts"),
        join(serviceRoot, "src/**/test-fixtures/**"),
      ],
      files: [join(serviceRoot, "src/test-fixtures/foundation-worker.ts")],
    }),
  );
  await promisify(execFile)(process.execPath, [
    join(serviceRoot, "node_modules/typescript/bin/tsc"),
    "-p",
    buildConfiguration,
  ]).catch((error: { stdout: string; stderr: string }) => {
    throw new Error(`${error.stdout}\n${error.stderr}`);
  });
  await fs.symlink(join(serviceRoot, "node_modules"), join(compiled, "node_modules"), "dir");
  function worker(crash: boolean) {
    // Buffer IPC notifications so a fast child cannot outrun an assertion's listener.
    const child = fork(
      join(compiled, "test-fixtures/foundation-worker.js"),
      [JSON.stringify({ ...configuration, crash })],
      { silent: true },
    );
    let stderr = "";
    child.stderr!.on("data", (value) => {
      stderr += String(value);
    });
    const messages: { type: string; detail: unknown }[] = [];
    const waiters = new Map<
      string,
      { resolve: (value: unknown) => void; reject: (error: Error) => void }
    >();
    child.on("message", (message) => {
      const notification = message as { type: string; detail: unknown };
      const waiter = waiters.get(notification.type);
      if (waiter) {
        waiters.delete(notification.type);
        waiter.resolve(notification.detail);
      } else messages.push(notification);
    });
    const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) =>
      child.once("exit", (code, signal) => {
        resolve({ code, signal });
        for (const waiter of waiters.values())
          waiter.reject(new Error(`Worker exited (${code}, ${signal}): ${stderr}`));
        waiters.clear();
      }),
    );
    child.on("error", (error) => {
      for (const waiter of waiters.values()) waiter.reject(error);
      waiters.clear();
    });
    cleanup.push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await exited;
      }
    });
    return {
      child,
      exited,
      wait(type: string) {
        const index = messages.findIndex((message) => message.type === type);
        if (index >= 0) return Promise.resolve(messages.splice(index, 1)[0]!.detail);
        if (child.exitCode !== null || child.signalCode !== null)
          return Promise.reject(new Error(`Worker exited: ${stderr}`));
        return new Promise<unknown>((resolve, reject) => waiters.set(type, { resolve, reject }));
      },
    };
  }
  function threadSynchronized() {
    // The fake boundary reports the protocol acknowledgement; there is no readiness poll.
    return new Promise<void>((resolve) => {
      server.hooks.acknowledged = (tag) => {
        if (tag === "orchestration.subscribeThread") {
          delete server.hooks.acknowledged;
          resolve();
        }
      };
    });
  }
  const firstSynchronized = threadSynchronized();
  const first = worker(true);
  const machine = blueprintVersionKey({ commit: original, path: "blueprints/oven.yml" });
  expect(await first.wait("started")).toEqual({ current: original, machine, portfolio: original });
  await Promise.all([first.wait("github-baseline"), firstSynchronized]);
  thread.latestTurn = {
    turnId: "turn-one" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "running",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: null,
    assistantMessageId: null,
  };
  thread.session.activeTurnId = thread.latestTurn.turnId;
  server.change(thread);
  expect(await first.wait("delivered")).toMatchObject({ type: "t3.turn.started" });
  api.issues.get("I_A")!.state = "CLOSED";
  api.issues.get("I_A")!.stateReason = "COMPLETED";
  first.child.send("webhook");
  expect(await first.wait("received")).toMatchObject({ status: "accepted", duplicate: false });
  expect(await first.wait("inside-delivery")).toMatchObject({ type: "github.issue.closed" });
  first.child.kill("SIGKILL");
  expect(await first.exited).toEqual({ code: null, signal: "SIGKILL" });

  const interrupted = openStore({ path: configuration.path });
  try {
    expect(interrupted.loadSnapshot("oven-one")).toMatchObject({
      machine,
      snapshot: { value: "warming", context: { count: 1, readings: ["t3.turn.started"] } },
    });
    expect(interrupted.pendingInbox("oven-one").map((row) => row.payload)).toEqual([
      expect.objectContaining({ type: "github.issue.closed" }),
    ]);
  } finally {
    interrupted.close();
  }

  // Force an authoritative thread snapshot on restart, with the same turn still running.
  // It must not turn the already committed start into another actor event.
  server.setBound(0);
  server.change(thread);
  const current = await commit("cooling", original);
  const resumedSynchronized = threadSynchronized();
  const resumed = worker(false);
  expect(await resumed.wait("started")).toEqual({ current, machine, portfolio: original });
  expect(await resumed.wait("delivered")).toMatchObject({ type: "github.issue.closed" });
  await Promise.all([resumed.wait("github-baseline"), resumedSynchronized]);
  resumed.child.send("redelivery");
  expect(await resumed.wait("received")).toMatchObject({ status: "accepted", duplicate: true });
  resumed.child.send("stop");
  expect(await resumed.wait("report")).toMatchObject({
    portfolio: original,
    pending: [],
    snapshot: {
      machine,
      snapshot: {
        status: "active",
        value: "warming",
        context: { count: 2, readings: ["t3.turn.started", "github.issue.closed"] },
      },
    },
    usage: { accounts: [{ account: "meter", actual: 12 }] },
    balance: { allocation: 60, actual: 12, outstanding: 8, available: 40 },
  });
  expect(await resumed.exited).toEqual({ code: 0, signal: null });

  // Read through the ledger's public interface on the store's populated database file.
  const recovered = openStore({ path: configuration.path });
  try {
    const portfolio = openPortfolio({ connection: recovered.connection, now: () => 10 });
    expect(portfolio.current().commit).toBe(original);
    expect(portfolio.githubProject({ owner: "sample", number: 1 })).toMatchObject({
      item: "baking",
      environment: "station",
      t3codeProjects: ["project"],
    });
    expect(portfolio.t3codeProject({ environment: "station", id: "project" })).toMatchObject({
      item: "baking",
      via: "association",
    });
    expect(
      portfolio.ledger.balance({ item: "baking", account: "meter", waiting: [] }),
    ).toMatchObject({ allocation: 60, actual: 12, outstanding: 8, available: 40 });
    expect(recovered.pendingInbox("oven-one")).toEqual([]);
  } finally {
    recovered.close();
  }
}, 60000);
