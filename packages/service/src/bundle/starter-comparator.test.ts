// ---
// relationships:
//   verifies: default-process
// ---
import { readFile } from "node:fs/promises";
import { expect, it } from "vite-plus/test";
import { createComparatorSandbox } from "../comparator-sandbox/index.ts";
import { render } from "../agent-threads/templates.ts";
import { memoryRevision } from "@wyrd-company/manifold-shared";
it("reserves small positive estimates, defaults absent estimates and skips blocked or unaffordable tasks", async () => {
  const text = await readFile(
    new URL("../../../../examples/starter/comparators/estimate.ts", import.meta.url),
    "utf8",
  );
  const loaded = await (
    await createComparatorSandbox()
  ).load({ name: "comparators/estimate.ts", text });
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) throw new Error(loaded.failure.message);
  try {
    for (const [dollars, amount] of [
      [0.0000001, 1],
      [0.00001, 10],
      [undefined, 1000000],
    ] as const) {
      const task = {
        id: "parcel",
        item: "work",
        age: 10,
        criticalPath: 0,
        dependencies: "clear" as const,
        fields: dollars === undefined ? {} : { Estimate: { number: dollars } },
      };
      const input = { population: [task], holders: [], balances: { work: { agents: amount } } };
      expect(loaded.comparator.evaluate(input, 1)).toMatchObject({
        ok: true,
        selection: { task: "parcel", reservations: [{ account: "agents", amount }] },
      });
      expect(
        loaded.comparator.evaluate({ ...input, balances: { work: { agents: amount - 1 } } }, 1),
      ).toMatchObject({ ok: true, selection: null });
      expect(
        loaded.comparator.evaluate(
          { ...input, population: [{ ...task, dependencies: "blocked" }] },
          1,
        ),
      ).toMatchObject({ ok: true, selection: null });
    }
  } finally {
    loaded.comparator.dispose();
  }
});

it("renders the starter prompt with an issue, estimate and calling thread", async () => {
  const text = await readFile(
    new URL("../../../../examples/starter/templates/task.njk", import.meta.url),
    "utf8",
  );
  const revision = Promise.resolve(memoryRevision("a".repeat(40), { "templates/task.njk": text }));
  const values = {
    issue: { repository: "example-org/parcels", number: 7 },
    fields: { Estimate: { number: 2 } },
    thread: "thread-1",
  };
  expect(await render(revision, "templates/task.njk", values, false)).toContain("pass thread-1");
  expect(await render(revision, "templates/task.njk", values, false)).toContain(
    "example-org/parcels#7",
  );
  expect(await render(revision, "templates/task.njk", { ...values, fields: {} }, false)).toContain(
    "handoff",
  );
  await expect(
    render(revision, "templates/task.njk", { ...values, thread: undefined }, false),
  ).rejects.toMatchObject({ kind: "template" });
});
