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
  expect(expressionsConfigurationSchema).toEqual(schema);
  expect(expressionsDefaults).toEqual({ timeoutMs: schema.properties.timeoutMs.default });
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

it("loads defaulted and explicit expressions sections through the service root", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { loadServiceConfiguration } = await import("./service-configuration/index.ts");
  const directory = await mkdtemp(join(tmpdir(), "configuration-"));
  const file = join(directory, "service.yml");
  const root =
    "processRepository:\n  url: https://example.invalid/process.git\n  directory: ./process\n";
  try {
    for (const [section, expected] of [
      ["", 1000],
      ["expressions: {}\n", 1000],
      ["expressions: { timeoutMs: 60000 }\n", 60000],
    ] as const) {
      await writeFile(file, root + section);
      expect((await loadServiceConfiguration(file)).expressions).toEqual({ timeoutMs: expected });
    }
    await writeFile(file, root + "expressions: { timeoutMs: 249 }\n");
    await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: "/expressions/timeoutMs" })],
    });
    await writeFile(file, root + "expressions: { unknown: 1000 }\n");
    await expect(loadServiceConfiguration(file)).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: "/expressions/unknown" })],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
