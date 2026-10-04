// ---
// relationships:
//   verifies: [intake, intake-records-table]
// ---
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  memoryRevision,
  intakeDecisionModelSchema,
  githubEventsSchema,
  serviceConfigurationSchemas,
} from "@wyrd-company/manifold-shared";
import { ActorStartError } from "../actor-host/index.ts";
import { openUsage, usageMigrationSteps } from "../usage/index.ts";
import { stringify } from "yaml";
import { createRevisions } from "../service/revisions.ts";
import { openPortfolio, portfolioMigrationSteps } from "../portfolio/index.ts";
import { ledgerMigrationSteps } from "../ledger/index.ts";
import type { IntakeRevision } from "./index.ts";
import { decisionModelSchema } from "../../../shared/src/decision-model-schema.ts";
import { createDecisionModels } from "../decision-models.ts";
import { startIntake, intakeMigrationSteps } from "./index.ts";
import type { IntakeOptions } from "./index.ts";
import { setup, files, issue, first, second, portfolio } from "./test-fixtures/fixture.ts";
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function fixture(source = files(), options: Partial<IntakeOptions> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "intake-test-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const s = await setup(join(dir, "store.sqlite"), source, options);
  cleanup.push(() => s.close());
  return s;
}
it("records once, starts one actor and hands off mirror state and later issue events", async () => {
  const s = await fixture();
  s.intake.discovered(["I1", "I1"]);
  s.intake.revisionLoaded();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.errors).toEqual([]);
  expect(s.host.host.actorOf("task:I1")).toMatchObject({
    commit: first,
    manifold: { issue: "I1", project: "P1" },
  });
  expect(s.store.loadSnapshot("task:I1")?.snapshot["entries"]).toMatchObject({ count: 2 });
  expect(s.intake.record("I1")).toMatchObject({
    status: "started",
    attempts: 1,
    actorId: "task:I1",
    commit: first,
    portfolioItem: "beta",
    blueprintVersion: first + ":blueprints/parcel.yml",
  });
  expect(s.host.starts).toEqual(["task:I1"]);
  expect(s.host.inputs).toMatchObject([{ task: { item: { nodeId: "ITEM1", archived: false } } }]);
  expect(s.store.loadSnapshot("task:I1")).toMatchObject({
    machine: first + ":blueprints/parcel.yml",
    snapshot: {
      context: {
        manifold: {
          issue: "I1",
          project: "P1",
          environment: "env-one",
          portfolioItem: "beta",
          blueprintPath: "blueprints/parcel.yml",
        },
      },
    },
  });
  s.intake.discovered(["I1"]);
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.host.starts).toHaveLength(1);
  const event = s.host.router.publish({
    source: "github",
    eventId: "scan-1",
    topics: ["github.issue.I1"],
    event: { type: "scanned", value: 8 },
  });
  expect(event.status).toBe("accepted");
  await new Promise((resolve) => setImmediate(resolve));
  expect(s.store.loadSnapshot("task:I1")?.snapshot["context"]).toMatchObject({ seen: [8] });
  const ajv = new Ajv2020({ strict: false });
  for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
  ajv.addSchema(decisionModelSchema);
  ajv.addSchema(githubEventsSchema);
  ajv.addSchema(intakeDecisionModelSchema);
  for (const [def, data] of [
    ["intake-record", s.intake.record("I1")],
    ["decision-input", (s.intake.record("I1")!.evaluation as { input: unknown }).input],
    ["task-input", s.host.inputs[0]],
  ] as const) {
    const validate = ajv.compile({ $ref: intakeDecisionModelSchema.$id + "#/$defs/" + def });
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
  }
});
it("defaults a parent item to its Other and chooses the first binding by name", async () => {
  const s = await fixture(files('{"blueprint":"blueprints/parcel.yml"}'));
  const current = s.current()!;
  s.setCurrent({
    ...current,
    portfolio: {
      ...current.portfolio,
      declaration: {
        ...current.portfolio.declaration,
        githubProjects: [
          { ...current.portfolio.declaration.githubProjects[0]!, name: "z-last" },
          { ...current.portfolio.declaration.githubProjects[0]!, name: "a-first", number: 2 },
        ],
      },
    },
  });
  const tracked = issue();
  s.tracked.set("I1", {
    ...tracked,
    items: [
      ...tracked.items,
      { ...tracked.items[0]!, project: { nodeId: "P2", owner: "EXAMPLE-ORG", number: 2 } },
    ],
  });
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({
    status: "started",
    binding: "a-first",
    portfolioItem: "alpha/other",
    project: { nodeId: "P2" },
  });
});
it.each([
  [
    "manifest",
    undefined,
    {
      findings: [
        {
          file: "manifold.yml",
          location: "",
          kind: "manifest-missing",
          message: "Missing process manifest.",
          severity: "error",
        },
      ],
    },
  ],
  ["decision-model", '($error("bad quote"))', undefined],
  [
    "output",
    '{"blueprint":"blueprints/parcel.yml","extra":7}',
    { errors: [{ instancePath: "", message: "must NOT have additional properties" }] },
  ],
  [
    "blueprint-unloaded",
    '{"blueprint":"blueprints/missing.yml"}',
    { path: "blueprints/missing.yml", findings: [] },
  ],
  [
    "item-unknown",
    '{"blueprint":"blueprints/parcel.yml","portfolioItem":"unknown"}',
    { item: "unknown" },
  ],
  [
    "item-outside-binding",
    '{"blueprint":"blueprints/parcel.yml","portfolioItem":"other"}',
    { item: "other", binding: "first", bindingItem: "alpha" },
  ],
  [
    "item-outside-binding",
    '{"blueprint":"blueprints/parcel.yml","portfolioItem":"delta"}',
    { item: "delta", binding: "first", bindingItem: "alpha" },
  ],
  [
    "input-invalid",
    '{"blueprint":"blueprints/parcel.yml"}',
    { errors: [{ instancePath: "", message: "boolean schema is false" }] },
  ],
] as const)("records %s without starting", async (kind, expression, detail) => {
  const source = files(expression, kind !== "input-invalid");
  if (kind === "manifest") delete (source as Record<string, string>)["manifold.yml"];
  const s = await fixture(source);
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({ status: "failed", failure: { kind } });
  const record = s.intake.record("I1")!;
  if (kind === "decision-model") {
    expect(record.failure?.detail).toEqual((record.evaluation as { error: unknown }).error);
    expect(record.failure?.detail).toMatchObject({
      kind: "evaluation",
      model: "models/quote.yml",
      nodeId: "quote",
      message: "bad quote",
    });
  } else expect(record.failure?.detail).toEqual(detail);
  expect(s.host.starts).toEqual([]);
});
it.each(["binding-missing", "binding-archived", "item-archived"] as const)(
  "records %s",
  async (kind) => {
    const s = await fixture();
    const current = s.current()!;
    s.setCurrent({
      ...current,
      portfolio:
        kind === "item-archived"
          ? portfolio(first, "alpha", true)
          : {
              ...current.portfolio,
              declaration: {
                ...current.portfolio.declaration,
                githubProjects:
                  kind === "binding-missing"
                    ? []
                    : current.portfolio.declaration.githubProjects.map((b) => ({
                        ...b,
                        archived: true,
                      })),
              },
            },
    });
    s.intake.revisionLoaded();
    await s.intake.idle();
    expect(s.intake.record("I1")).toMatchObject({ status: "failed", failure: { kind } });
    expect(s.intake.record("I1")?.failure?.detail).toEqual(
      kind === "binding-missing"
        ? {}
        : kind === "binding-archived"
          ? { bindings: ["first"] }
          : { item: "beta" },
    );
    expect(s.host.starts).toEqual([]);
  },
);
it("retries failed decisions only at a later commit", async () => {
  const s = await fixture(files('{"blueprint":"blueprints/parcel.yml","portfolioItem":"missing"}'));
  s.intake.revisionLoaded();
  await s.intake.idle();
  s.intake.revisionLoaded();
  s.intake.revisionLoaded();
  await s.intake.idle();
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.intake.record("I1")?.attempts).toBe(1);
  const revision = memoryRevision(second, files());
  s.revisions.set(second, revision);
  s.setCurrent({
    revision,
    blueprints: await s.loader.loadRevision(revision),
    portfolio: portfolio(second),
  });
  s.intake.revisionLoaded();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({ status: "started", commit: second, attempts: 2 });
});
it("holds one immutable basis while evaluation awaits and starts with the latest mirror facts", async () => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let evaluating!: () => void;
  const entered = new Promise<void>((r) => (evaluating = r));
  const s = await fixture(files(), {
    createModels: (models) => {
      const real = createDecisionModels(models);
      return {
        ...real,
        async evaluate(key, input) {
          evaluating();
          await held;
          return real.evaluate(key, input);
        },
      };
    },
  });
  s.intake.discovered(["I1"]);
  await entered;
  const revision = memoryRevision(
    second,
    files('{"blueprint":"blueprints/parcel.yml","portfolioItem":"gamma"}'),
  );
  s.revisions.set(second, revision);
  s.setCurrent({
    revision,
    blueprints: await s.loader.loadRevision(revision),
    portfolio: portfolio(second, "gamma"),
  });
  s.intake.revisionLoaded();
  s.tracked.set("I1", { ...issue(), issue: { ...issue().issue, state: "closed" } });
  release();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.host.inputs).toMatchObject([{ task: { issue: { state: "closed" } } }]);
  expect(s.intake.record("I1")).toMatchObject({
    status: "started",
    commit: first,
    portfolioCommit: first,
    portfolioItem: "beta",
    blueprintVersion: first + ":blueprints/parcel.yml",
    evaluation: { input: { task: { issue: { state: "open" } }, binding: { item: "alpha" } } },
  });
});
it("uses a decision table over the selected field and defaults to another leaf", async () => {
  const s = await fixture();
  s.tracked.set("I1", {
    ...issue(),
    items: [
      {
        ...issue().items[0]!,
        fields: { Track: { kind: "single-select", optionId: "bolt", name: "Bolts" } },
      },
    ],
  });
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({ status: "started", portfolioItem: "gamma" });
});
it("does not decide again after a start exception, and refuses decision changes in SQL", async () => {
  let fail = true;
  const s = await fixture(files(), {
    actors: {
      start() {
        if (fail) throw new Error("host failed");
      },
    },
  });
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({ status: "recorded" });
  expect(s.errors).toMatchObject([{ kind: "start" }]);
  const db = s.store.connection.database;
  expect(() =>
    db.prepare("UPDATE intake_record SET status='failed' WHERE issue_node_id='I1'").run(),
  ).toThrow();
  expect(() =>
    db
      .prepare(
        "UPDATE intake_record SET blueprint_path='blueprints/other.yml' WHERE issue_node_id='I1'",
      )
      .run(),
  ).toThrow();
  expect(() => db.prepare("DELETE FROM intake_record").run()).toThrow();
  expect(() =>
    db
      .prepare(
        "UPDATE intake_record SET issue_node_id='I2', actor_id='task:I2' WHERE issue_node_id='I1'",
      )
      .run(),
  ).toThrow();
  fail = false;
  s.intake.revisionLoaded();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({ status: "started", attempts: 1 });
  expect(() => db.prepare("UPDATE intake_record SET updated_at=0").run()).toThrow();
  expect(intakeMigrationSteps.join("\n").trim()).toBe(
    readFileSync("../../docs/specifications/intake-records-table.sql", "utf8").trim(),
  );
});
it("preserves the recorded version and item through input-invalid and unavailable starts", async () => {
  let changed = false;
  const source = files(undefined, {
    type: "object",
    properties: {
      task: {
        type: "object",
        properties: { issue: { type: "object", properties: { state: { const: "open" } } } },
      },
    },
  });
  const s = await fixture(source, {
    probe(step) {
      if (step === "recorded") {
        changed = true;
        s.tracked.set("I1", { ...issue(), issue: { ...issue().issue, state: "closed" } });
      }
    },
  });
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(changed).toBe(true);
  const record = s.intake.record("I1")!;
  expect(record).toMatchObject({
    status: "recorded",
    startFailure: {
      kind: "input-invalid",
      detail: {
        errors: [{ instancePath: "/task/issue/state", message: "must be equal to constant" }],
      },
    },
    startAttempts: 1,
    attempts: 1,
  });
  expect(record.startFailure?.detail).toEqual({
    errors: [{ instancePath: "/task/issue/state", message: "must be equal to constant" }],
  });
  await s.intake.stop();
  const base = {
    store: s.store,
    tracked: {
      trackedIssue: (id: string) => s.tracked.get(id),
      trackedIssueIds: () => [...s.tracked.keys()],
    },
    current: s.current,
    actors: s.host.host,
  };
  const unavailable = startIntake({
    ...base,
    blueprints: { version: async () => ({ status: "missing", reason: "commit" }) },
  });
  await unavailable.idle();
  expect(unavailable.record("I1")).toMatchObject({
    status: "recorded",
    startFailure: {
      kind: "version-unavailable",
      detail: { version: record.blueprintVersion, reason: "commit" },
    },
    blueprintVersion: record.blueprintVersion,
    portfolioItem: record.portfolioItem,
  });
  expect(unavailable.record("I1")?.startFailure?.detail).toEqual({
    version: record.blueprintVersion,
    reason: "commit",
  });
  await unavailable.stop();
  s.tracked.set("I1", issue());
  const revision = memoryRevision(second, files());
  s.revisions.set(second, revision);
  s.setCurrent({
    revision,
    blueprints: await s.loader.loadRevision(revision),
    portfolio: portfolio(second, "gamma"),
  });
  const retry = startIntake({ ...base, blueprints: s.loader });
  await retry.idle();
  expect(retry.record("I1")).toMatchObject({
    status: "started",
    commit: first,
    blueprintVersion: record.blueprintVersion,
    portfolioItem: record.portfolioItem,
  });
  await retry.stop();
});
it("waits for the first basis and leaves unreadable revisions queued until a wake", async () => {
  const s = await fixture();
  const original = s.current()!;
  s.setCurrent(undefined);
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toBeUndefined();
  s.setCurrent({
    ...original,
    revision: {
      ...original.revision,
      read: async () => {
        throw new Error("read failed");
      },
    },
  });
  s.intake.revisionLoaded();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.errors).toMatchObject([{ kind: "read" }]);
  s.setCurrent(original);
  s.intake.revisionLoaded();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")?.status).toBe("started");
  await s.intake.stop();
  await s.intake.stop();
  expect(() => s.intake.discovered(["I1"])).toThrow(TypeError);
  expect(() => s.intake.revisionLoaded()).toThrow(TypeError);
});
it("captures the previous whole publication while the follower awaits load and apply", async () => {
  let follower: ReturnType<typeof createRevisions> | undefined;
  const s = await fixture(files(), { current: () => follower?.current() });
  s.store.connection.migrate("ledger", ledgerMigrationSteps);
  s.store.connection.migrate("portfolio", portfolioMigrationSteps);
  const realPortfolio = openPortfolio({ connection: s.store.connection });
  const declarations = {
    "portfolio.yml": stringify({ items: { alpha: { items: { beta: {}, gamma: {} } }, delta: {} } }),
    "bindings.yml": stringify({
      githubProjects: {
        first: { owner: "example-org", number: 1, environment: "env-one", item: "alpha" },
      },
    }),
  };
  const a = memoryRevision(first, { ...files(), ...declarations });
  const b = memoryRevision(second, {
    ...files('{"blueprint":"blueprints/parcel.yml","portfolioItem":"gamma"}'),
    ...declarations,
    "portfolio.yml": stringify({
      items: { alpha: { title: "Packages", items: { beta: {}, gamma: {} } }, delta: {} },
    }),
  });
  s.revisions.set(first, a);
  s.revisions.set(second, b);
  let revision = a;
  let loadDone!: () => void,
    applyDone!: () => void,
    loadStarted!: () => void,
    applyStarted!: () => void;
  const loading = new Promise<void>((r) => (loadDone = r));
  const applying = new Promise<void>((r) => (applyDone = r));
  const inLoad = new Promise<void>((r) => (loadStarted = r));
  const inApply = new Promise<void>((r) => (applyStarted = r));
  const published: IntakeRevision[] = [];
  follower = createRevisions({
    repository: {
      current: () => revision,
      revisionAt: async (commit) => s.revisions.get(commit),
      pull: async () => ({ kind: "unchanged", commit: revision.commit }),
    },
    blueprints: {
      ...s.loader,
      async loadRevision(r) {
        if (r.commit === second) {
          loadStarted();
          await loading;
        }
        return s.loader.loadRevision(r);
      },
    },
    portfolio: {
      ...realPortfolio,
      async apply(r) {
        const result = await realPortfolio.apply(r);
        if (r.commit === second) {
          applyStarted();
          await applying;
        }
        return result;
      },
    },
    usage: (() => {
      s.store.connection.migrate("usage", usageMigrationSteps);
      return openUsage({
        connection: s.store.connection,
        ledger: realPortfolio.ledger,
        portfolio: realPortfolio,
        threadProject: () => undefined,
        environments: new Set(["env-one"]),
      });
    })(),
    log: () => {},
    applied: () => {
      published.push(follower!.current()!);
      s.intake.revisionLoaded();
    },
  });
  cleanup.push(() => {
    loadDone();
    applyDone();
    return follower!.close();
  });
  expect(follower.current()).toBeUndefined();
  await follower.follow();
  await s.intake.idle();
  revision = b;
  const job = follower.follow();
  await inLoad;
  expect(follower.latest()?.commit).toBe(first);
  expect(follower.current()?.revision.commit).toBe(first);
  expect(published).toHaveLength(1);
  s.tracked.set("I2", issue("I2"));
  s.intake.discovered(["I2"]);
  await s.intake.idle();
  expect(s.intake.record("I2")).toMatchObject({
    commit: first,
    portfolioCommit: first,
    portfolioItem: "beta",
  });
  loadDone();
  await inApply;
  expect(realPortfolio.current().commit).toBe(second);
  expect(follower.current()?.revision.commit).toBe(first);
  expect(follower.latest()?.commit).toBe(second);
  expect(published).toHaveLength(1);
  s.tracked.set("I3", issue("I3"));
  s.intake.discovered(["I3"]);
  await s.intake.idle();
  expect(s.intake.record("I3")).toMatchObject({
    commit: first,
    portfolioCommit: first,
    portfolioItem: "beta",
  });
  applyDone();
  await job;
  s.tracked.set("I4", issue("I4"));
  s.intake.discovered(["I4"]);
  await s.intake.idle();
  expect(s.intake.record("I4")).toMatchObject({
    status: "started",
    commit: second,
    portfolioCommit: second,
    blueprintVersion: second + ":blueprints/parcel.yml",
    portfolioItem: "gamma",
  });
  expect(
    published.map((r) => [r.revision.commit, r.blueprints.commit, r.portfolio.commit]),
  ).toEqual([
    [first, first, first],
    [second, second, second],
  ]);
  const rejected = "c".repeat(40);
  revision = memoryRevision(rejected, {
    ...files(),
    ...declarations,
    "portfolio.yml": "items: [invalid]",
  });
  s.revisions.set(rejected, revision);
  await follower.follow();
  s.tracked.set("I5", issue("I5"));
  s.intake.discovered(["I5"]);
  await s.intake.idle();
  expect(s.intake.record("I5")).toMatchObject({
    status: "started",
    commit: rejected,
    portfolioCommit: second,
    portfolioItem: "beta",
  });
  expect(published.at(-1)?.portfolio.commit).toBe(second);
  expect(follower.current()?.blueprints.commit).toBe(rejected);
});
it("stop waits for the active evaluation, discards queued work, then disposes models once", async () => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let started!: () => void;
  const entered = new Promise<void>((r) => (started = r));
  let disposals = 0;
  const s = await fixture(files(), {
    createModels: (models) => {
      const real = createDecisionModels(models);
      return {
        ...real,
        dispose() {
          disposals++;
          real.dispose();
        },
        async evaluate(key, input) {
          started();
          await held;
          return real.evaluate(key, input);
        },
      };
    },
  });
  s.intake.discovered(["I1"]);
  await entered;
  s.tracked.set("I2", issue("I2"));
  s.intake.discovered(["I2"]);
  let stopped = false;
  const stop = s.intake.stop().then(() => {
    stopped = true;
  });
  await new Promise((r) => setImmediate(r));
  expect(stopped).toBe(false);
  expect(disposals).toBe(0);
  release();
  await stop;
  expect(s.intake.record("I1")?.status).toBe("started");
  expect(s.intake.record("I2")).toBeUndefined();
  await s.intake.stop();
  expect(disposals).toBe(1);
});
it("reconcile at startup takes an already tracked population", async () => {
  const s = await fixture();
  await s.intake.stop();
  s.tracked.set("I2", issue("I2"));
  const intake = startIntake({
    store: s.store,
    tracked: {
      trackedIssue: (id) => s.tracked.get(id),
      trackedIssueIds: () => [...s.tracked.keys()],
    },
    blueprints: s.loader,
    current: s.current,
    actors: s.host.host,
  });
  await intake.idle();
  expect(intake.record("I1")?.status).toBe("started");
  expect(intake.record("I2")?.status).toBe("started");
  expect(s.host.starts).toEqual(["task:I1", "task:I2"]);
  await intake.stop();
});
it("checks again for an existing snapshot after the recorded version awaits", async () => {
  const s = await fixture(files(), {
    actors: {
      start() {
        throw new Error("host failed");
      },
    },
  });
  s.intake.revisionLoaded();
  await s.intake.idle();
  await s.intake.stop();
  let release!: () => void, loading!: () => void;
  const held = new Promise<void>((r) => (release = r)),
    entered = new Promise<void>((r) => (loading = r));
  const intake = startIntake({
    store: s.store,
    tracked: {
      trackedIssue: (id) => s.tracked.get(id),
      trackedIssueIds: () => [...s.tracked.keys()],
    },
    current: s.current,
    actors: s.host.host,
    blueprints: {
      async version(v) {
        loading();
        await held;
        return s.loader.version(v);
      },
    },
  });
  await entered;
  const version = s.intake.record("I1")!.blueprintVersion!;
  s.store.saveSnapshot({
    actorId: "task:I1",
    machine: version,
    snapshot: { status: "active", value: "sorting", context: { manifold: { issue: "I1" } } },
  });
  release();
  await intake.idle();
  expect(intake.record("I1")?.status).toBe("started");
  expect(s.host.starts).toEqual([]);
  await intake.stop();
});
it("keeps a recorded decision when the issue disappears and starts it when tracked again", async () => {
  const s = await fixture(files(), {
    probe(step) {
      if (step === "recorded") s.tracked.delete("I1");
    },
  });
  s.intake.discovered(["I1", "absent"]);
  await s.intake.idle();
  expect(s.intake.record("I1")?.status).toBe("recorded");
  expect(s.intake.record("absent")).toBeUndefined();
  expect(s.host.starts).toEqual([]);
  s.tracked.set("I1", issue());
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.intake.record("I1")?.status).toBe("started");
});
it("uses an existing snapshot without reading an unavailable recorded version", async () => {
  const s = await fixture(files(), {
    actors: {
      start() {
        throw new Error("host failed");
      },
    },
  });
  s.intake.revisionLoaded();
  await s.intake.idle();
  await s.intake.stop();
  s.store.saveSnapshot({
    actorId: "task:I1",
    machine: s.intake.record("I1")!.blueprintVersion!,
    snapshot: { status: "active", value: "sorting", context: { manifold: { issue: "I1" } } },
  });
  let reads = 0;
  const intake = startIntake({
    store: s.store,
    tracked: {
      trackedIssue: (id) => s.tracked.get(id),
      trackedIssueIds: () => [...s.tracked.keys()],
    },
    current: s.current,
    actors: s.host.host,
    blueprints: {
      async version() {
        reads++;
        return { status: "missing", reason: "commit" };
      },
    },
  });
  await intake.idle();
  expect(reads).toBe(0);
  expect(intake.record("I1")?.status).toBe("started");
  expect(s.host.starts).toEqual([]);
  await intake.stop();
});

it("starts exactly one actor when a strict schema accepts only task and intake", async () => {
  const s = await fixture(
    files(undefined, {
      type: "object",
      properties: { task: { type: "object" }, intake: { type: "object" } },
      required: ["task", "intake"],
      additionalProperties: false,
    }),
  );
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({ status: "started", attempts: 1 });
  expect(s.host.starts).toEqual(["task:I1"]);
  expect(s.host.host.actorOf("task:I1")).toMatchObject({ manifold: { issue: "I1" } });
});
it("records input-invalid when a strict machine schema requires manifold", async () => {
  const s = await fixture(
    files(undefined, {
      type: "object",
      properties: {
        manifold: { type: "object" },
        task: { type: "object" },
        intake: { type: "object" },
      },
      required: ["manifold", "task", "intake"],
      additionalProperties: false,
    }),
  );
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({
    status: "failed",
    attempts: 1,
    failure: {
      kind: "input-invalid",
      detail: { errors: [{ instancePath: "", message: "must have required property 'manifold'" }] },
    },
  });
  expect(s.errors).toEqual([]);
  expect(s.host.starts).toEqual([]);
});
it("records identity errors and host ActorStartError as input-invalid", async () => {
  const failed: unknown[] = [];
  const s = await fixture(files(), {
    onFailed: (record) => failed.push(record),
    actors: {
      start(request) {
        throw new ActorStartError(request.actorId, [
          { path: "/task/issue", message: "Invalid issue" },
        ]);
      },
    },
  });
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.intake.record("I1")).toMatchObject({
    status: "recorded",
    startAttempts: 1,
    startFailure: {
      kind: "input-invalid",
      detail: { errors: [{ instancePath: "/task/issue", message: "Invalid issue" }] },
    },
  });
  expect(s.errors).toEqual([]);
  expect(failed).toHaveLength(1);
  const current = s.current()!;
  s.setCurrent({
    ...current,
    portfolio: {
      ...current.portfolio,
      declaration: {
        ...current.portfolio.declaration,
        githubProjects: current.portfolio.declaration.githubProjects.map((b) => ({
          ...b,
          environment: "",
        })),
      },
    },
  });
  s.tracked.set("I2", issue("I2"));
  s.intake.discovered(["I2"]);
  await s.intake.idle();
  expect(s.intake.record("I2")).toMatchObject({
    status: "failed",
    failure: {
      kind: "input-invalid",
      detail: {
        errors: [
          {
            instancePath: "/manifold/environment",
            message: "must NOT have fewer than 1 characters",
          },
        ],
      },
    },
  });
});
