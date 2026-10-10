// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { applyModelDraft, changedFiles, settleModelDraft } from "./model-drafts.ts";
import { changeDraft, readDraft, writeDraft } from "../draft.ts";
const draft = {
  base: "a".repeat(40),
  baseText: "blueprint",
  text: "blueprint",
  saveId: "1".repeat(32),
};
test("Apply stages only the model, clears save identity, and removes an edit reverted to base", () => {
  const applied = applyModelDraft(draft, "decision-models/quote.yml", {
    baseText: "old",
    text: "new",
    exists: true,
  });
  expect(applied.saveId).toBeUndefined();
  expect(applied.text).toBe("blueprint");
  expect(changedFiles("blueprints/quote.yml", applied, false)).toEqual([
    { path: "decision-models/quote.yml", text: "new", added: false },
  ]);
  expect(
    applyModelDraft(applied, "decision-models/quote.yml", {
      baseText: "old",
      text: "old",
      exists: true,
    }).models,
  ).toEqual({});
  expect(changeDraft(applied, "changed blueprint").models).toEqual(applied.models);
});
test("model-only drafts survive storage and malformed entries do not", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const applied = applyModelDraft(draft, "decision-models/quote.yml", {
    baseText: "old",
    text: "new",
    exists: true,
  });
  writeDraft(storage, "blueprints/quote.yml", applied);
  expect(readDraft(storage, "blueprints/quote.yml")).toEqual(applied);
  values.set(
    "manifold.blueprint-draft.blueprints/quote.yml",
    JSON.stringify({
      ...applied,
      models: { "decision-models/quote.yml": { text: 7 } },
    }),
  );
  expect(readDraft(storage, "blueprints/quote.yml")).toBeUndefined();
});
test("settlement reads one current revision and retains saved model text after a later model-only change", () => {
  const saved = {
    ...applyModelDraft(draft, "decision-models/quote.yml", {
      baseText: "old",
      text: "saved model",
      exists: true,
    }),
    saved: "b".repeat(40),
  };
  expect(
    settleModelDraft(
      saved,
      { commit: "c".repeat(40), text: "blueprint" },
      { "decision-models/quote.yml": { text: "saved model", exists: true } },
      true,
    ),
  ).toBeUndefined();
  expect(
    settleModelDraft(
      saved,
      { commit: "c".repeat(40), text: "blueprint" },
      { "decision-models/quote.yml": { text: "later model", exists: true } },
      true,
    ),
  ).toEqual({
    base: "c".repeat(40),
    baseText: "blueprint",
    text: "blueprint",
    models: {
      "decision-models/quote.yml": {
        baseText: "later model",
        text: "saved model",
        exists: true,
      },
    },
  });
  expect(settleModelDraft(saved, { commit: "c".repeat(40), text: "blueprint" }, {}, false)).toEqual(
    saved,
  );
});

test("pending settlement requires an applied revision and every model read", () => {
  const pending = {
    ...applyModelDraft(draft, "sample.yml", { baseText: "old", text: "saved", exists: true }),
    saved: "b".repeat(40),
  };
  const source = { commit: "b".repeat(40), text: "blueprint" };
  expect(
    settleModelDraft(pending, source, { "sample.yml": { text: "saved", exists: true } }, false),
  ).toEqual(pending);
  expect(settleModelDraft(pending, source, {}, true)).toEqual(pending);
  expect(
    settleModelDraft(
      pending,
      { text: "blueprint" },
      { "sample.yml": { text: "saved", exists: true } },
      true,
    ),
  ).toEqual(pending);
});
