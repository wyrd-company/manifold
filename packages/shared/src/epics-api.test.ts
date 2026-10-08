// ---
// relationships:
//   verifies: epics-api
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import { isEpicResponse, isEpicRootsResponse } from "./epics-api.ts";
const api = parse(
  readFileSync(
    new URL("../../../docs/specifications/epics-api.openapi.yml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false });
ajv.addFormat("uri", {
  type: "string",
  validate: (v: string) => /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(v),
});
ajv.addSchema({ $id: "epics", ...api });
function corruptions(value: unknown): unknown[] {
  if (Array.isArray(value))
    return [
      [],
      ...value.flatMap((child, index) =>
        corruptions(child).map((bad) => value.map((v, i) => (i === index ? bad : v))),
      ),
    ];
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    return [
      { ...value, unknown: true },
      ...entries.flatMap(([key, child]) => [
        Object.fromEntries(entries.filter(([k]) => k !== key)),
        ...[null, 42, {}, [], ...corruptions(child)].map((bad) => ({ ...value, [key]: bad })),
      ]),
    ];
  }
  return [null, {}, [], false];
}
test("epics guards agree with the OpenAPI response schemas for nested corruptions", () => {
  const issue = {
    nodeId: "parcel",
    repository: "example/delivery",
    number: 1,
    state: "open",
    title: "Deliver parcel",
    url: "https://example.test/1",
  };
  const epic = {
    epic: {
      root: "parcel",
      issues: [
        {
          issue,
          placement: "tree",
          parent: "order",
          task: {
            actorId: "task:parcel",
            projects: [
              { binding: "deliveries", status: "Ready" },
              { binding: "secondary", status: null },
            ],
            actor: { status: "active", states: ["ready"] },
            openEscalations: 1,
          },
        },
      ],
      dependencies: [{ blocking: "box", blocked: "parcel" }],
    },
  };
  for (const [schema, guard, body] of [
    ["EpicResponse", isEpicResponse, epic],
    ["EpicRootsResponse", isEpicRootsResponse, { roots: [{ issue }] }],
  ] as const) {
    const validate = ajv.compile({ $ref: `epics#/components/schemas/${schema}` });
    expect(validate(body)).toBe(true);
    expect(guard(body)).toBe(true);
    for (const invalid of corruptions(body))
      expect(guard(invalid), JSON.stringify(invalid)).toBe(Boolean(validate(invalid)));
  }
  for (const key of ["__proto__", "constructor", "toString"])
    expect(isEpicRootsResponse(JSON.parse(`{"roots":[],"${key}":true}`))).toBe(false);
});
