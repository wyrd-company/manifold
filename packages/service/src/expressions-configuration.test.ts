// ---
// relationships:
//   verifies: expressions-configuration
// ---
import { readFileSync } from "node:fs";
import { expect, it } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { expressionsConfigurationSchema } from "@wyrd-company/manifold-shared";
import { expressionsDefaults } from "./index.ts";

const schema = parse(
  readFileSync(
    new URL("../../../docs/specifications/expressions-configuration.schema.yml", import.meta.url),
    "utf8",
  ),
);
const validate = new Ajv2020().compile(expressionsConfigurationSchema);
it("agrees with the approved section schema and shipped default", () => {
  expect(expressionsConfigurationSchema).toMatchObject({
    $schema: schema.$schema,
    type: schema.type,
    additionalProperties: schema.additionalProperties,
  });
  const { description: _description, ...timeoutMs } = schema.properties.timeoutMs;
  expect(expressionsConfigurationSchema.properties.timeoutMs).toEqual(timeoutMs);
  expect(expressionsDefaults).toEqual({ timeoutMs: timeoutMs.default });
});
it.each([{}, { timeoutMs: 250 }, { timeoutMs: 1000 }, { timeoutMs: 60000 }])(
  "accepts section %j",
  (value) => {
    expect(validate(value)).toBe(true);
  },
);
it.each([
  null,
  [],
  1,
  { timeoutMs: 249 },
  { timeoutMs: 60001 },
  { timeoutMs: 250.5 },
  { timeoutMs: "1000" },
  { timeoutMs: null },
  { other: 1000 },
])("rejects section %j", (value) => {
  expect(validate(value)).toBe(false);
});
