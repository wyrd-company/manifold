// ---
// relationships:
//   verifies: blueprint
// ---
import { expect, it } from "vite-plus/test";
import { stringify } from "yaml";
import { lintBlueprint } from "./index.ts";
const names = {
  actors: new Set<string>(),
  actions: new Set<string>(),
  guards: new Set<string>(),
  delays: new Set<string>(),
};
const lint = (gate: unknown) =>
  lintBlueprint(
    "blueprints/parcels.yml",
    stringify({
      schemas: { input: true, output: true, context: true, events: {} },
      machine: {
        initial: "waiting",
        states: { waiting: { meta: { gate } }, packed: {}, finished: { type: "final" } },
      },
    }),
    names,
  );
it("rejects a missing return point and state references outside the declared machine", async () => {
  expect(await lint({ comparator: "comparators/order.ts" })).toMatchObject({
    ok: false,
    findings: [{ kind: "shape" }],
  });
  expect(
    await lint({ comparator: "comparators/order.ts", return: { state: "absent" } }),
  ).toMatchObject({ ok: false, findings: [{ kind: "gate" }] });
  expect(
    await lint({ comparator: "comparators/order.ts", return: { state: "waiting" } }),
  ).toMatchObject({ ok: false, findings: [{ kind: "gate" }] });
  expect(
    await lint({ comparator: "comparators/order.ts", return: { state: "packed" } }),
  ).toMatchObject({ ok: true });
});
