// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, test } from "vite-plus/test";
import { parse } from "yaml";
import { accountRows, usedBy } from "./rows.ts";
import { applyAccountEdit } from "./edits.ts";
import { formFor, editFor } from "./form.ts";
const text = `# keep this comment
accounts:
  acct:
    unit: usd
    kind: api
    capacity: { amount: 10, reset: '2026-01-01T01:00:00+01:00', every: { days: 2 } }
    usage: [{ environment: env-one, provider: codex, instance: first }, { environment: env-one, provider: codex, instance: second }]
`;
test("keeps multiple instances and offset reset on a capacity-only edit", () => {
  const row = accountRows(text)[0]!;
  const form = formFor(row, new Date());
  expect(form.usage).toEqual([{ environment: "env-one", instances: ["first", "second"] }]);
  expect(editFor(form, row)).toEqual({ kind: "set", name: "acct" });
  const edit = editFor({ ...form, amount: "20" }, row);
  expect(edit).not.toHaveProperty("usage");
  if ("invalid" in edit) throw Error("fixture");
  const applied = applyAccountEdit(text, edit);
  if (!applied.ok) throw Error("fixture");
  expect(applied.text).toContain("# keep this comment");
  expect(parse(applied.text).accounts.acct.usage).toEqual(parse(text).accounts.acct.usage);
});
test("provider-only edits replace every instance, mixed-provider usage stays untouched", () => {
  const row = accountRows(text)[0]!;
  expect(editFor({ ...formFor(row, new Date()), provider: "claude" }, row)).toMatchObject({
    usage: [
      { provider: "claude", instance: "first" },
      { provider: "claude", instance: "second" },
    ],
  });
  const mixed = accountRows(
    text.replace("provider: codex, instance: second", "provider: claude, instance: second"),
  )[0]!;
  expect(
    editFor({ ...formFor(mixed, new Date()), provider: "grok", amount: "30" }, mixed),
  ).not.toHaveProperty("usage");
});
test("archive and restore converge; names and YAML shape are checked", () => {
  const edit = { kind: "archive", name: "acct" } as const;
  const first = applyAccountEdit(text, edit);
  if (!first.ok) throw Error("fixture");
  expect(applyAccountEdit(first.text, edit)).toEqual(first);
  expect(
    usedBy(accountRows(first.text), {
      account: "new",
      environment: "env-one",
      provider: "codex",
      instance: "first",
    }),
  ).toBeUndefined();
  const restored = applyAccountEdit(first.text, { kind: "restore", name: "acct" });
  if (!restored.ok) throw Error("fixture");
  expect(parse(restored.text).accounts.acct).not.toHaveProperty("archived");
  expect(applyAccountEdit("accounts: []", edit)).toEqual({ ok: false, reason: "unparsable" });
  expect(applyAccountEdit(text, { kind: "restore", name: "missing" })).toEqual({
    ok: false,
    reason: "name-missing",
  });
});
test("new account converts custom window and local reset; invalid fields are local", () => {
  const form = {
    ...formFor(undefined, new Date(2026, 0, 1)),
    name: "acct-b",
    amount: "12.50",
    window: { count: "2", unit: "hours" } as const,
  };
  const edit = editFor(form, undefined);
  expect(edit).toMatchObject({
    kind: "add",
    account: { capacity: { amount: 12.5, every: { hours: 2 } } },
  });
  if ("invalid" in edit) throw Error("fixture");
  expect(applyAccountEdit("", edit)).toMatchObject({ ok: true });
  expect(applyAccountEdit(text, { ...edit, name: "acct" })).toEqual({
    ok: false,
    reason: "name-taken",
  });
  for (const [field, value] of [
    ["amount", ""],
    ["reset", "invalid"],
    ["window", { count: "", unit: "hours" }],
  ] as const)
    expect(editFor({ ...form, [field]: value }, undefined)).toEqual({ invalid: field });
});
test("reordering usage alone gives no edit and additional environments preserve all instances", () => {
  const row = accountRows(text)[0]!;
  const form = formFor(row, new Date());
  expect(
    editFor({ ...form, usage: [{ environment: "env-one", instances: ["second", "first"] }] }, row),
  ).toEqual({ kind: "set", name: "acct" });
  expect(
    editFor(
      {
        ...form,
        amount: "30",
        usage: [...form.usage, { environment: "env-two", instances: [""] }],
      },
      row,
    ),
  ).toMatchObject({
    capacity: { amount: 30 },
    usage: [
      { environment: "env-one", instance: "first" },
      { environment: "env-one", instance: "second" },
      { environment: "env-two" },
    ],
  });
  expect(
    usedBy([row], {
      account: "another",
      environment: "env-one",
      provider: "codex",
      instance: "second",
    }),
  ).toBe("acct");
  expect(
    usedBy([row], {
      account: "acct",
      environment: "env-one",
      provider: "codex",
      instance: "second",
    }),
  ).toBeUndefined();
});
test("an unchanged fractional reset stays in its declared text", () => {
  const row = accountRows(text.replace("01:00:00+01:00", "01:00:00.123+01:00"))[0]!;
  expect(editFor(formFor(row, new Date()), row)).toEqual({ kind: "set", name: "acct" });
});
test("an unchanged reset keeps its instant in a repeated local hour", () => {
  const previous = process.env["TZ"];
  process.env["TZ"] = "America/New_York";
  try {
    const row = accountRows(
      text.replace("2026-01-01T01:00:00+01:00", "2026-11-01T01:30:00-05:00"),
    )[0]!;
    expect(editFor(formFor(row, new Date()), row)).toEqual({ kind: "set", name: "acct" });
  } finally {
    if (previous === undefined) delete process.env["TZ"];
    else process.env["TZ"] = previous;
  }
});
test("usage collisions require the same environment, provider and instance", () => {
  const rows = accountRows(text);
  const entry = {
    account: "another",
    environment: "env-one",
    provider: "codex" as const,
    instance: "first",
  };
  expect(usedBy(rows, entry)).toBe("acct");
  expect(usedBy(rows, { ...entry, environment: "env-two" })).toBeUndefined();
  expect(usedBy(rows, { ...entry, provider: "claude" })).toBeUndefined();
  expect(usedBy(rows, { ...entry, instance: "third" })).toBeUndefined();
});
