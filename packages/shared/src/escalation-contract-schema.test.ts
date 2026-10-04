// ---
// relationships:
//   verifies: escalation-contract
// ---
import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { Ajv2020 } from "ajv/dist/2020.js";
import { expect, test } from "vite-plus/test";
import {
  escalationContractSchema,
  manifoldImplementationNames,
  serviceConfigurationSchemas,
} from "./index.ts";
test("bundled escalation contract equals the YAML asset and its boundaries compile", async () => {
  expect(escalationContractSchema).toEqual(
    parse(
      await readFile(
        new URL("../../../docs/specifications/escalation-contract.schema.yml", import.meta.url),
        "utf8",
      ),
    ),
  );
  const ajv = new Ajv2020();
  for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
  ajv.addSchema(escalationContractSchema);
  for (const name of [
    "escalate-input",
    "escalation-answered-event",
    "api-answer-request",
    "api-answer-response",
    "ntfy-ask",
    "ntfy-close",
  ])
    expect(ajv.compile({ $ref: escalationContractSchema.$id + "#/$defs/" + name })).toBeTypeOf(
      "function",
    );
  expect(manifoldImplementationNames.actors.has("escalate")).toBe(true);
});

test("blueprint lint resolves the shipped escalation input and answered-event schemas", async () => {
  const { lintBlueprint } = await import("./index.ts");
  const { stringify } = await import("yaml");
  const result = await lintBlueprint(
    "parcel.yml",
    stringify({
      schemas: {
        input: true,
        output: true,
        context: true,
        events: {
          "escalation.answered": {
            $ref: escalationContractSchema.$id + "#/$defs/escalation-answered-event",
          },
        },
        actors: {
          escalate: {
            input: { $ref: escalationContractSchema.$id + "#/$defs/escalate-input" },
            output: true,
          },
        },
      },
      machine: {
        id: "parcel",
        initial: "asking",
        states: {
          asking: {
            invoke: { src: "escalate", input: { question: "Send it?", freeText: true } },
            on: { "escalation.answered": "delivered" },
          },
          delivered: { type: "final" },
        },
      },
    }),
    manifoldImplementationNames,
  );
  expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
});
