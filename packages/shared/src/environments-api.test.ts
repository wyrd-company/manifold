// ---
// relationships:
//   verifies: environments-api
// ---
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { expect, test } from "vite-plus/test";
import {
  isEnvironmentSummary,
  isEnvironmentsResponse,
  isEnvironmentErrorResponse,
  isEnvironmentAction,
} from "./environments-api.ts";
const summary = {
  name: "site-a",
  host: "example.invalid:3773",
  url: "ws://example.invalid:3773",
  status: "connected",
  connection: "connected",
  paused: false,
  disconnected: false,
  activeThreads: 1,
  scheduledThreads: 0,
};
const ajv = new Ajv2020({ strict: false, validateFormats: false });
ajv.addSchema(
  parse(
    readFileSync(
      new URL("../../../docs/specifications/environments-api.openapi.yml", import.meta.url),
      "utf8",
    ),
  ),
  "environments",
);
for (const [name, guard, valid, invalid] of [
  [
    "EnvironmentSummary",
    isEnvironmentSummary,
    [summary, { ...summary, error: "Unavailable", activeThreads: null }],
    [
      { ...summary, name: "INVALID" },
      { ...summary, name: "a".repeat(65) },
      { ...summary, host: "" },
      { ...summary, connection: "paused" },
      { ...summary, status: "invalid" },
      { ...summary, disconnected: 1 },
      { ...summary, paused: 1 },
      { ...summary, error: "" },
      { ...summary, activeThreads: -1 },
      { ...summary, scheduledThreads: 0.5 },
      { ...summary, extra: true },
    ],
  ],
  [
    "EnvironmentsResponse",
    isEnvironmentsResponse,
    [
      { configurationFile: "/tmp/service.yml", environments: [summary] },
      { configurationFile: "service.yml", environments: [] },
    ],
    [
      { configurationFile: "", environments: [] },
      { configurationFile: "service.yml", environments: [{}] },
    ],
  ],
  [
    "ErrorResponse",
    isEnvironmentErrorResponse,
    [{ error: { kind: "action-failed", message: "" } }],
    [
      { error: { kind: "unknown", message: "error" } },
      { error: { kind: "not-found", message: "error", extra: true } },
    ],
  ],
  [
    "EnvironmentAction",
    isEnvironmentAction,
    ["pause", "resume", "disconnect", "reconnect"],
    ["stop", null, 1],
  ],
] as const)
  test(`${name} guard matches OpenAPI fixtures`, () => {
    const validate = ajv.compile({ $ref: `environments#/components/schemas/${name}` });
    for (const value of valid) {
      expect(validate(value)).toBe(true);
      expect(guard(value)).toBe(true);
    }
    for (const value of [...invalid, null, {}]) {
      expect(validate(value)).toBe(false);
      expect(guard(value)).toBe(false);
    }
  });
test("requires a URI at the boundary", () =>
  expect(isEnvironmentSummary({ ...summary, url: "not a uri" })).toBe(false));
