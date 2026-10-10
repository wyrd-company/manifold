// ---
// relationships:
//   verifies: [tasks-api, escalation-contract]
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import { escalationContractSchema } from "@wyrd-company/manifold-shared";
import { isTaskResponse, isTasksResponse } from "@wyrd-company/manifold-shared/tasks-api";
import {
  isEscalation,
  isEscalationAnswerResponse,
} from "@wyrd-company/manifold-shared/escalations-api";
import { boardWorld } from "./test-fixtures/world.ts";
const api = parse(
  readFileSync(
    new URL("../../../../docs/specifications/tasks-api.openapi.yml", import.meta.url),
    "utf8",
  ),
);
const ajv = new Ajv2020({ strict: false });
ajv.addFormat("uri", {
  type: "string",
  validate: (value: string) => /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(value),
});
ajv.addFormat("date-time", {
  type: "string",
  validate: (value: string) => Number.isFinite(Date.parse(value)),
});
ajv.addSchema(escalationContractSchema);
ajv.addSchema({ $id: "tasks", ...api });
function corruptions(value: unknown): unknown[] {
  if (Array.isArray(value))
    return value.flatMap((child, index) =>
      corruptions(child).map((bad) => value.map((v, i) => (i === index ? bad : v))),
    );
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
test("task and escalation guards agree with their schemas for populated and malformed HTTP responses", async () => {
  const f = boardWorld();
  try {
    const bodies: [string, (v: unknown) => boolean, unknown][] = [
      ["tasks#/components/schemas/TasksResponse", isTasksResponse, f.tasks.list()],
      ["tasks#/components/schemas/TaskResponse", isTaskResponse, f.tasks.get("task:parcel")],
      [`${escalationContractSchema.$id}#/$defs/escalation`, isEscalation, f.escalation],
      [
        `${escalationContractSchema.$id}#/$defs/api-answer-response`,
        isEscalationAnswerResponse,
        { outcome: "answered", escalation: f.escalation },
      ],
    ];
    for (const [ref, guard, body] of bodies) {
      const validate = ajv.compile({ $ref: ref });
      expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
      expect(guard(body)).toBe(true);
      for (const invalid of corruptions(body))
        expect(guard(invalid), `${ref} ${JSON.stringify(invalid)}`).toBe(
          Boolean(validate(invalid)),
        );
    }
  } finally {
    await f.close();
  }
});
