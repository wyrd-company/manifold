// ---
// relationships:
//   verifies: blueprint-migration
// ---
import { expect, test } from "vite-plus/test";
import { createBlueprintExpressions } from "./blueprint-expressions.ts";
const schema = {
  type: "object",
  required: ["zone"],
  properties: { zone: { type: "string" } },
  additionalProperties: false,
};
const blueprint = (expression = '{"zone": context.depot}') => ({
  machine: { initial: "waiting", states: { waiting: {} } },
  schemas: { context: schema, events: {} },
  migrations: [
    {
      from: { type: "object", required: ["depot"] },
      context: { type: "expression.map", params: { expression } },
    },
  ],
});
test("maps the first matching context shape and preserves compatible context without a path", () => {
  const expressions = createBlueprintExpressions(blueprint(), { onError: () => {} });
  expect(expressions.migrateContext({ depot: "north", manifold: { actorId: "sample" } })).toEqual({
    status: "mapped",
    context: { zone: "north" },
    path: 0,
  });
  expect(expressions.migrateContext({ zone: "south", manifold: {} })).toEqual({
    status: "unchanged",
    context: { zone: "south", manifold: {} },
  });
  expect(expressions.migrateContext({})).toMatchObject({ status: "failed", kind: "no-path" });
});
test.each([
  ['$error("bad")', "mapping-failed"],
  ['{"zone": 42}', "context-rejected"],
  ['{"manifold": {}}', "mapping-failed"],
  ["42", "mapping-failed"],
])("refuses mapping %s with %s", (expression, kind) => {
  expect(
    createBlueprintExpressions(blueprint(expression), { onError: () => {} }).migrateContext({
      depot: "north",
    }),
  ).toMatchObject({ status: "failed", kind });
});
test("a migration mapping uses the approved worker wait and the next mapping runs after restart", async () => {
  const expressions = createBlueprintExpressions(
    blueprint("($spin := function(){ $spin() }; $spin())"),
    { onError: () => {} },
  );
  expect(expressions.migrateContext({ depot: "north" })).toMatchObject({
    status: "failed",
    kind: "mapping-timeout",
  });
  expect(
    createBlueprintExpressions(blueprint(), { onError: () => {} }).migrateContext({
      depot: "south",
    }),
  ).toMatchObject({ status: "mapped", context: { zone: "south" } });
});
