// ---
// relationships:
//   verifies: [intake, escalations]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { setup, files, issue, second, portfolio } from "./test-fixtures/fixture.ts";
import { createDecisionModels } from "../decision-models.ts";
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
const expression =
  'task.fields.Track.name = "Gears" ? {"blueprint":"missing.yml"} : {"blueprint":"blueprints/parcel.yml"}';
async function fixture(options: Parameters<typeof setup>[2] = {}, source = files(expression)) {
  const dir = mkdtempSync(join(tmpdir(), "intake-notice-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const s = await setup(join(dir, "store.sqlite"), source, options);
  cleanup.push(() => s.close());
  return s;
}
function changed() {
  const value = issue();
  return {
    ...value,
    items: value.items.map((item) => ({
      ...item,
      fields: { Track: { kind: "single-select" as const, optionId: "paper", name: "Paper" } },
    })),
  };
}
it("raises one current failure, retries a changed field once, and withdraws on success", async () => {
  const s = await fixture();
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.escalations.list({ status: "open" })).toMatchObject([
    { title: "Intake failed", raiser: { kind: "intake-failed", subject: { issue: "I1" } } },
  ]);
  expect(s.escalations.list({ status: "open" })[0]?.question).toContain(
    "Issue: example-org/widgets#7",
  );
  s.intake.mirrorChanged();
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.intake.record("I1")?.attempts).toBe(1);
  s.tracked.set("I1", changed());
  s.intake.mirrorChanged();
  s.intake.mirrorChanged();
  await s.intake.idle();
  expect(s.host.starts).toEqual(["task:I1"]);
  expect(s.intake.record("I1")).toMatchObject({ status: "started", attempts: 2 });
  expect(s.escalations.list({ status: "open" })).toEqual([]);
});
it("operator retry at the same commit creates the next occurrence; dismiss preserves the record", async () => {
  const s = await fixture();
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  const first = s.escalations.list({ status: "open" })[0]!;
  s.escalations.answer(first.id, { choice: "retry" }, "api");
  await s.intake.idle();
  expect(s.intake.record("I1")?.attempts).toBe(2);
  const next = s.escalations.list({ status: "open" })[0]!;
  expect(next.raiser).toMatchObject({ occurrence: 2 });
  const record = s.intake.record("I1");
  s.escalations.answer(next.id, { choice: "dismiss" }, "api");
  expect(s.intake.record("I1")).toEqual(record);
});
it("withdraws an untracked failure without changing its record", async () => {
  const s = await fixture();
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  const record = s.intake.record("I1");
  s.tracked.delete("I1");
  s.intake.mirrorChanged();
  await s.intake.idle();
  expect(s.escalations.list({ status: "open" })).toEqual([]);
  expect(s.intake.record("I1")).toEqual(record);
});
it("takes a field change committed during the first evaluation without raising a stale question", async () => {
  let entered!: () => void, release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const evaluating = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let first = true;
  const s = await fixture({
    createModels(models) {
      const real = createDecisionModels(models);
      return {
        ...real,
        async evaluate(...args) {
          if (first) {
            first = false;
            entered();
            await held;
          }
          return real.evaluate(...args);
        },
      };
    },
  });
  s.intake.discovered(["I1"]);
  await evaluating;
  s.tracked.set("I1", changed());
  s.intake.mirrorChanged();
  release();
  await s.intake.idle();
  expect(s.host.starts).toEqual(["task:I1"]);
  expect(s.intake.record("I1")?.attempts).toBe(2);
  expect(s.escalations.list({})).toEqual([]);
});

it("rolls the failed record back when raising its escalation fails", async () => {
  const s = await fixture({
    escalations: {
      withdraw: () => {},
      raise: () => {
        throw new Error("database fault");
      },
    },
  });
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.intake.record("I1")).toBeUndefined();
  expect(s.errors).toMatchObject([{ kind: "store" }]);
});
it("cuts long failure detail at a character boundary within the question limit", async () => {
  const s = await fixture({
    createModels() {
      return {
        findings: [],
        evaluate: async (model, input) => ({
          model,
          input,
          trace: {},
          outcome: "error" as const,
          error: { model, kind: "evaluation" as const, message: "📦".repeat(10000) },
        }),
        dispose: () => {},
      };
    },
  });
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.escalations.list({ status: "open" })).toHaveLength(1);
  const question = s.escalations.list({ status: "open" })[0]!.question;
  expect(s.errors).toEqual([]);
  expect(question.length).toBeLessThanOrEqual(8000);
  expect(question).toContain("Detail was cut.");
  expect(Buffer.from(question).toString("utf8")).toBe(question);
});
it("canonicalizes a reordered mirror and retries a changed relationship once", async () => {
  const s = await fixture();
  const original = {
    ...issue(),
    blockedBy: [
      { ...issue("B2").issue, nodeId: "B2", state: "open" as const },
      { ...issue("B1").issue, nodeId: "B1", state: "closed" as const },
    ],
  };
  s.tracked.set("I1", original);
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  const first = s.escalations.list({ status: "open" })[0]!;
  s.tracked.set("I1", { ...original, blockedBy: [...original.blockedBy].toReversed() });
  s.intake.mirrorChanged();
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  expect(s.intake.record("I1")?.attempts).toBe(1);
  s.tracked.set("I1", { ...original, blockedBy: [] });
  s.intake.mirrorChanged();
  await s.intake.idle();
  expect(s.intake.record("I1")?.attempts).toBe(2);
  expect(s.escalations.list({ status: "open" }).map((e) => e.id)).toEqual([first.id]);
});

it("replaces an open question when the failure kind changes", async () => {
  const s = await fixture();
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  const old = s.escalations.list({ status: "open" })[0]!;
  const revision = memoryRevision(
    second,
    files('{"blueprint":"blueprints/parcel.yml","portfolioItem":"absent"}'),
  );
  s.revisions.set(second, revision);
  s.setCurrent({
    revision,
    blueprints: await s.loader.loadRevision(revision),
    portfolio: portfolio(second),
  });
  s.intake.revisionLoaded();
  await s.intake.idle();
  expect(s.escalations.get(old.id)?.status).toBe("withdrawn");
  expect(s.escalations.list({ status: "open" })[0]?.question).toContain("item-unknown");
  expect(s.escalations.list({ status: "open" })[0]?.raiser).toMatchObject({ occurrence: 2 });
});

it("replaces a decision failure with a start failure and preserves the recorded choice", async () => {
  const s = await fixture(
    {
      probe(step) {
        if (step === "recorded")
          s.tracked.set("I1", { ...changed(), issue: { ...issue().issue, state: "closed" } });
      },
    },
    files(expression, {
      type: "object",
      properties: {
        task: {
          type: "object",
          properties: { issue: { type: "object", properties: { state: { const: "open" } } } },
        },
      },
    }),
  );
  s.intake.discovered(["I1"]);
  await s.intake.idle();
  const first = s.escalations.list({ status: "open" })[0]!;
  s.tracked.set("I1", changed());
  s.intake.mirrorChanged();
  await s.intake.idle();
  expect(s.escalations.get(first.id)?.status).toBe("withdrawn");
  expect(s.intake.record("I1")).toMatchObject({
    status: "recorded",
    startFailure: { kind: "input-invalid" },
    blueprintPath: "blueprints/parcel.yml",
  });
  expect(s.escalations.list({ status: "open" })[0]?.question).toContain(
    "Start failure: input-invalid",
  );
  expect(s.escalations.list({ status: "open" })[0]?.raiser).toMatchObject({ occurrence: 2 });
});
it("raises nothing when the issue leaves tracking during its first evaluation", async () => {
  let entered!: () => void, release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const evaluating = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const s = await fixture({
    createModels(models) {
      const real = createDecisionModels(models);
      return {
        ...real,
        async evaluate(...args) {
          entered();
          await held;
          return real.evaluate(...args);
        },
      };
    },
  });
  s.intake.discovered(["I1"]);
  await evaluating;
  s.tracked.delete("I1");
  s.intake.mirrorChanged();
  release();
  await s.intake.idle();
  expect(s.intake.record("I1")?.status).toBe("failed");
  expect(s.escalations.list({})).toEqual([]);
});
