// ---
// relationships:
//   verifies: github-events
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import { githubEventsSchema } from "./index.ts";

test("task field value boundaries compile with Ajv's strict type rules", () => {
  const asset = parse(
    readFileSync(
      new URL("../../../docs/specifications/github-events.schema.yml", import.meta.url),
      "utf8",
    ),
  );
  const ajv = new Ajv2020({ strictTypes: true });
  ajv.addSchema(asset);
  const validate = ajv.compile({ $ref: asset.$id + "#/$defs/task-field-value" });
  for (const value of [
    { state: "set", value: "Normal" },
    { state: "set", value: 3 },
    { state: "empty" },
    { state: "invalid", detail: "Type differs" },
    { state: "unavailable", detail: "Not read" },
  ])
    expect(validate(value)).toBe(true);
  expect(validate({ state: "set", value: true })).toBe(false);
  expect(githubEventsSchema).toEqual(asset);
});
test("the task field write and Tasks API boundaries use strict type schemas", async () => {
  const { blueprintSchema, taskMetadataDeclarationSchema } = await import("./index.ts");
  const ajv = new Ajv2020({ strictTypes: true });
  ajv.addSchema(taskMetadataDeclarationSchema);
  ajv.addSchema(blueprintSchema);
  const write = ajv.compile({ $ref: blueprintSchema.$id + "#/$defs/task-field-set-input" });
  for (const value of ["Normal", 3, null]) expect(write({ field: "Weight", value })).toBe(true);
  expect(write({ field: "Weight", value: true })).toBe(false);
  const tasks = parse(
    readFileSync(
      new URL("../../../docs/specifications/tasks-api.openapi.yml", import.meta.url),
      "utf8",
    ),
  );
  const taskValue = ajv.compile(tasks.components.schemas.TaskFieldValue);
  expect(taskValue({ state: "set", value: "Normal" })).toBe(true);
  expect(taskValue({ state: "set", value: 3 })).toBe(true);
  expect(taskValue({ state: "set", value: null })).toBe(false);
});
