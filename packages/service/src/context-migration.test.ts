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
  const document = blueprint();
  document.migrations.push({
    ...document.migrations[0]!,
    context: { type: "expression.map", params: { expression: '{"zone": "second"}' } },
  });
  const errors: unknown[] = [];
  const expressions = createBlueprintExpressions(document, {
    onError: (error) => errors.push(error),
  });
  expect(expressions.migrateContext({ depot: "north", manifold: { actorId: "sample" } })).toEqual({
    ok: true,
    context: { zone: "north" },
    path: 0,
  });
  expect(expressions.migrateContext({ zone: "south", manifold: {} })).toEqual({
    ok: true,
    context: { zone: "south" },
  });
  expect(expressions.migrateContext({})).toMatchObject({
    ok: false,
    kind: "no-path",
    schemaErrors: expect.any(Array),
  });
  expect(errors).toHaveLength(1);
});
test.each([
  ['$error("bad")', "mapping-failed"],
  ['{"zone": 42}', "context-rejected"],
  ['{"manifold": {}}', "mapping-failed"],
  ["42", "mapping-failed"],
])("refuses mapping %s with %s", (expression, kind) => {
  const errors: unknown[] = [];
  expect(
    createBlueprintExpressions(blueprint(expression), {
      onError: (error) => errors.push(error),
    }).migrateContext({
      depot: "north",
    }),
  ).toMatchObject({
    ok: false,
    kind,
    path: 0,
    error: expect.objectContaining({ location: "/migrations/0/context" }),
  });
  expect(errors).toHaveLength(1);
});
test("a migration mapping uses the approved worker wait and the next mapping runs after restart", async () => {
  const errors: unknown[] = [];
  const expressions = createBlueprintExpressions(
    blueprint("($spin := function(){ $spin() }; $spin())"),
    { onError: (error) => errors.push(error) },
  );
  expect(expressions.migrateContext({ depot: "north" })).toMatchObject({
    ok: false,
    kind: "mapping-timeout",
    path: 0,
    error: expect.objectContaining({ kind: "evaluation" }),
  });
  expect(errors).toHaveLength(1);
  expect(
    createBlueprintExpressions(blueprint(), { onError: () => {} }).migrateContext({
      depot: "south",
    }),
  ).toMatchObject({ ok: true, context: { zone: "south" } });
});
