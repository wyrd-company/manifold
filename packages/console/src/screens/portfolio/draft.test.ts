// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import {
  appendEdit,
  rebaseDraft,
  readPortfolioDraft,
  writePortfolioDraft,
  settlePortfolioDraft,
} from "./draft.ts";
test("draft persists edits, rejects malformed edits and rebases intent onto the latest text", () => {
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
  const base = {
    base: "a".repeat(40),
    baseText: "items:\n  alpha: {}\n",
    text: "items:\n  alpha: {}\n",
    edits: [],
  };
  const edited = appendEdit(base, {
    kind: "allocation",
    item: "alpha",
    account: "acct-a",
    guarantee: 70,
  });
  writePortfolioDraft(storage, edited);
  expect(readPortfolioDraft(storage)).toEqual(edited);
  const rebased = rebaseDraft(
    { ...edited, saveId: "x" },
    "b".repeat(40),
    "# later\nitems:\n  alpha: { title: Changed }\n",
  );
  expect(rebased.draft.text).toContain("# later");
  expect(rebased.draft.text).toContain("Changed");
  expect(rebased.draft.text).toContain("70");
  expect(rebased.draft.saveId).toBeUndefined();
  expect(
    settlePortfolioDraft(
      { ...edited, saved: "b".repeat(40) },
      { commit: "b".repeat(40), text: edited.text },
      true,
    ),
  ).toBeUndefined();
  values.set(
    "manifold.declaration-draft.portfolio.yml",
    JSON.stringify({ ...edited, text: base.baseText }),
  );
  expect(readPortfolioDraft(storage)).toBeUndefined();
  expect(values.size).toBe(0);
  values.set(
    "manifold.declaration-draft.portfolio.yml",
    JSON.stringify({
      ...edited,
      edits: [{ kind: "allocation", item: "alpha", account: "acct-a", guarantee: "bad" }],
    }),
  );
  expect(readPortfolioDraft(storage)).toBeUndefined();
  expect(values.size).toBe(0);
});
