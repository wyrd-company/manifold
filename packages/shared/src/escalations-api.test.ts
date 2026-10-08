// ---
// relationships:
//   verifies: escalation-contract
// ---
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import { escalationContractSchema } from "./escalation-contract-schema.ts";
import { isEscalationsResponse } from "./escalations-api.ts";
const validate = new Ajv2020({ strict: false }).compile({
  $ref: escalationContractSchema.$id + "#/$defs/escalation-list",
  $defs: escalationContractSchema.$defs,
  $id: escalationContractSchema.$id,
});
const escalation = {
  id: "a".repeat(22),
  raiser: { type: "blueprint", actorId: "sample", invokeId: "ask", entryId: "entry" },
  title: "Parcel question",
  question: "Where?",
  choices: [],
  freeText: true,
  destinations: [],
  status: "open",
  raisedAt: 100,
};
test.each([
  { escalations: [] },
  { escalations: [escalation] },
  {
    escalations: [
      {
        ...escalation,
        status: "answered",
        answer: { value: { text: "At the door" }, channel: "api", at: 200 },
        closedAt: 200,
      },
    ],
  },
  { escalations: [{ ...escalation, id: "short" }] },
  { escalations: [{ ...escalation, raisedAt: 1.5 }] },
  { escalations: [{}] },
  { escalations: [], extra: true },
  {},
  null,
])("list guard agrees with escalation-list for %j", (body) =>
  expect(isEscalationsResponse(body)).toBe(Boolean(validate(body))),
);
