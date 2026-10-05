// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { changeDraft, readDraft, writeDraft, settleDraft, savedDraft } from "./draft.ts";
const base = { base: "a".repeat(40), baseText: "first", text: "second" };
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
test("drafts survive reload, discard malformed entries, and remove equal text", () => {
  const s = storage();
  writeDraft(s, "sample", base);
  expect(readDraft(s, "sample")).toEqual(base);
  writeDraft(s, "sample", changeDraft(base, "first"));
  expect(readDraft(s, "sample")).toBeUndefined();
  s.setItem("manifold.blueprint-draft.sample", "{}");
  expect(readDraft(s, "sample")).toBeUndefined();
  expect(s.getItem("manifold.blueprint-draft.sample")).toBeNull();
});
test("save identity survives reload, changes clear it, and pending saves settle only against source", () => {
  const s = storage();
  const draft = { ...base, saveId: "b".repeat(32), message: "sample" };
  writeDraft(s, "sample", draft);
  expect(readDraft(s, "sample")?.saveId).toBe(draft.saveId);
  expect(changeDraft(draft, "third").saveId).toBeUndefined();
  const pending = savedDraft(draft, "c".repeat(40));
  expect(pending.saved).toBe("c".repeat(40));
  expect(settleDraft(pending, { commit: "c".repeat(40), text: "second" }, false)).toBeUndefined();
  expect(settleDraft(pending, { commit: "d".repeat(40), text: "third" }, false)).toEqual(pending);
  expect(settleDraft(pending, { commit: "d".repeat(40), text: "third" }, true)).toEqual({
    base: "d".repeat(40),
    baseText: "third",
    text: "second",
  });
});
test("declaration drafts use an independent prefix with unchanged blueprint defaults", () => {
  const s = storage();
  writeDraft(s, "sample", base);
  const changed = changeDraft(base, "third");
  writeDraft(s, "sample", changed, "manifold.declaration-draft.");
  expect(readDraft(s, "sample")).toEqual(base);
  expect(readDraft(s, "sample", "manifold.declaration-draft.")).toEqual(changed);
  writeDraft(s, "sample", undefined, "manifold.declaration-draft.");
  expect(readDraft(s, "sample")).toEqual(base);
});
