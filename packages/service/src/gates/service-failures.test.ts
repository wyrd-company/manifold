// ---
// relationships:
//   verifies: [gate-runtime, escalations]
// ---
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vite-plus/test";
import { world, blueprintPath } from "./test-fixtures/world.ts";
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0).toReversed()) close();
});
async function fixture(source: string | null) {
  const dir = mkdtempSync(join(tmpdir(), "comparator-notice-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const f = await world(join(dir, "store.sqlite"), undefined, undefined, source);
  cleanup.push(f.close);
  return f;
}
it.each([
  null,
  "export default 12;",
  'export default () => { throw new Error("bad order"); }',
  'export default () => ({ task: "absent" });',
])("keeps one open escalation for a comparator failure: %s", async (source) => {
  const f = await fixture(source);
  expect(f.escalations.list({ status: "open" })).toHaveLength(1);
  const first = f.escalations.list({ status: "open" })[0]!;
  expect(first).toMatchObject({
    title: "Comparator failed",
    raiser: {
      kind: "comparator-failed",
      subject: { gate: blueprintPath + "#open.lifecycle.waiting" },
      occurrence: 1,
    },
    choices: [{ id: "retry" }, { id: "dismiss" }],
  });
  f.gates.inputChanged();
  await new Promise((resolve) => setImmediate(resolve));
  expect(f.escalations.list({ status: "open" }).map((e) => e.id)).toEqual([first.id]);
  f.escalations.answer(first.id, { choice: "retry" }, "api");
  await expect
    .poll(() => f.escalations.list({ status: "open" })[0]?.raiser)
    .toMatchObject({ occurrence: 2 });
});
it("only a successful revision load withdraws a comparator failure", async () => {
  const f = await fixture(null);
  f.setSource("export default () => null;");
  await f.gates.prepare();
  expect(f.escalations.list({ status: "open" })).toHaveLength(1);
  await f.gates.revision({ blueprints: new Map([[blueprintPath, f.blueprint]]) }, f.revision);
  expect(f.escalations.list({ status: "open" })).toEqual([]);
});
it("dismiss does no work, and retry can load a missing comparator and grant a token", async () => {
  const f = await fixture(null);
  const failed = f.escalations.list({ status: "open" })[0]!;
  f.escalations.answer(failed.id, { choice: "dismiss" }, "api");
  await new Promise((resolve) => setImmediate(resolve));
  expect(f.escalations.list({ status: "open" })).toEqual([]);
  expect(
    f.store.connection.database.prepare("SELECT count(*) AS n FROM gates_token").get()?.["n"],
  ).toBe(0);
  await f.gates.prepare();
  const next = f.escalations.list({ status: "open" })[0]!;
  f.setSource("export default i => i.holders.length ? null : { task: i.population[0].id };");
  f.escalations.answer(next.id, { choice: "retry" }, "api");
  await expect
    .poll(
      () =>
        f.store.connection.database.prepare("SELECT count(*) AS n FROM gates_token").get()?.["n"],
    )
    .toBe(1);
});
