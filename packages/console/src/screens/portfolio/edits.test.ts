// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { applyEdits, itemId } from "./edits.ts";
test("edits retain comments and change allocations, Other, titles, nesting, archive and restore", () => {
  const source =
    "# keep this\nitems:\n  alpha: # keep item\n    allocations:\n      acct-a: { guarantee: 50 }\n  other: {}\n";
  const result = applyEdits(source, [
    { kind: "allocation", item: "other", account: "acct-a", guarantee: 10 },
    { kind: "title", item: "alpha", title: "Alpha title" },
    { kind: "add", parent: "alpha", id: "beta", title: "Beta" },
    {
      kind: "allocation",
      item: "beta",
      account: "acct-a",
      guarantee: 20,
      ceiling: 40,
      weight: 2,
      burst: 5,
    },
    { kind: "archive", item: "alpha" },
    { kind: "restore", item: "alpha" },
    {
      kind: "allocation",
      item: "beta",
      account: "acct-a",
      ceiling: null,
      weight: null,
      burst: null,
    },
    { kind: "title", item: "beta", title: "beta" },
  ]);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.text).toContain("# keep this");
  expect(result.text).toContain("# keep item");
  const doc = parse(result.text);
  expect(doc.items.alpha.allocations["acct-a"].guarantee).toBe(0);
  expect(doc.items.alpha.items.beta).toEqual({ allocations: { "acct-a": { guarantee: 0 } } });
  expect(doc.items.other.allocations["acct-a"].guarantee).toBe(10);
  expect(applyEdits(result.text, [{ kind: "restore", item: "alpha" }])).toMatchObject({
    ok: true,
    text: result.text,
  });
});
test("drops missing edits and refuses malformed or non-mapping YAML", () => {
  expect(
    applyEdits("items: {}", [{ kind: "title", item: "missing", title: "Missing" }]),
  ).toMatchObject({ ok: true, dropped: [{ kind: "title", item: "missing", title: "Missing" }] });
  expect(applyEdits("[", [])).toEqual({ ok: false });
  expect(applyEdits("- list", [])).toEqual({ ok: false });
  expect(
    applyEdits("", [{ kind: "add", parent: null, id: "alpha", title: "Alpha" }]),
  ).toMatchObject({ ok: true });
});
test("item ids reserve suffix space and remain unique declared names", () => {
  expect(itemId("One & two!", [])).toBe("one-two");
  expect(itemId("123", [])).toBe("item-123");
  expect(itemId("other", [])).toBe("other-2");
  const name = "a".repeat(70);
  const a = itemId(name, []),
    b = itemId(name, [a]),
    c = itemId(name, [a, b]);
  expect([a, b, c]).toEqual(["a".repeat(64), "a".repeat(62) + "-2", "a".repeat(62) + "-3"]);
});
test("restoring a parent retains separately archived descendants while zeroing their guarantees", () => {
  const result = applyEdits(
    "items:\n  alpha:\n    archived: true\n    items:\n      beta:\n        archived: true\n        allocations:\n          acct-a: { guarantee: 50 }\n",
    [{ kind: "restore", item: "alpha" }],
  );
  if (!result.ok) throw Error("fixture");
  const doc = parse(result.text);
  expect(doc.items.alpha.archived).toBeUndefined();
  expect(doc.items.alpha.items.beta.archived).toBe(true);
  expect(doc.items.alpha.items.beta.allocations["acct-a"].guarantee).toBe(0);
});
