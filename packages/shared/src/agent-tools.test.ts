// ---
// relationships:
//   verifies: [agent-tools, agent-tools-configuration, blueprint]
// ---
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { expect, test } from "vite-plus/test";
import {
  agentToolsSchema,
  agentToolDefinitions,
  agentToolsConfigurationSchema,
  manifoldImplementationNames,
  lintBlueprint,
} from "./index.ts";
import { createSchemaCompiler } from "./schema-compiler.ts";

test("embedded agent tools schemas agree with the declared contracts and compile", () => {
  for (const [name, schema] of [
    ["agent-tools", agentToolsSchema],
    ["agent-tools-configuration", agentToolsConfigurationSchema],
  ] as const) {
    expect(schema).toEqual(
      parse(
        readFileSync(
          new URL(`../../../docs/specifications/${name}.schema.yml`, import.meta.url),
          "utf8",
        ),
      ),
    );
  }
  const compile = createSchemaCompiler();
  const [request, response] = compile([
    { $ref: `${agentToolsSchema.$id}#/$defs/call-request` },
    { $ref: `${agentToolsSchema.$id}#/$defs/call-response` },
  ]);
  expect(
    request!({
      environment: "workstation",
      tool: "handoff",
      arguments: { handoff: null },
      meta: { callId: "call-one" },
    }),
  ).toBe(true);
  expect(
    response!({ status: "refused", code: "service-unreachable", message: "Retry in this turn." }),
  ).toBe(true);
  expect(response!({ status: "accepted", message: "Done" })).toBe(false);
  expect(agentToolDefinitions.map((tool) => tool.name)).toEqual([
    "handoff",
    "escalate",
    "get-messages",
  ]);
  for (const tool of agentToolDefinitions) {
    expect(tool.inputSchema.type).toBe("object");
    if (tool.name !== "get-messages") expect(tool.description).toContain("end your turn");
  }
  const [escalate] = compile([agentToolDefinitions[1]!.inputSchema]);
  expect(
    escalate!({
      question: "Where should the parcel go?",
      choices: [{ id: "north", label: "North" }],
    }),
  ).toBe(true);
  expect(escalate!({ question: "Where should the parcel go?" })).toBe(false);
});

test("only unknown agent event declarations fail event lint at their declarations", async () => {
  const blueprint = (events: Record<string, unknown>) =>
    stringify({
      schemas: { input: true, output: true, context: { type: "object" }, events },
      machine: {
        id: "parcel",
        initial: "waiting",
        context: {},
        states: { waiting: { on: { "agent.handoff": "done" } }, done: { type: "final" } },
      },
    });
  const result = await lintBlueprint(
    "parcel.yml",
    blueprint({ "agent.hand-off": true, "parcel.scanned": true }),
    manifoldImplementationNames,
  );
  expect(result).toMatchObject({
    ok: false,
    findings: [
      { kind: "event-unknown", name: "agent.hand-off", location: "/schemas/events/agent.hand-off" },
    ],
  });
  const clean = await lintBlueprint(
    "parcel.yml",
    blueprint({
      "agent.handoff": true,
      "agent.escalated": true,
      "agent.escalation.answered": true,
      "parcel.scanned": true,
    }),
    manifoldImplementationNames,
  );
  expect(clean.ok).toBe(true);
});

test("message sender schema accepts task context and rejects incomplete names", () => {
  const [validate] = createSchemaCompiler()([
    { $ref: `${agentToolsSchema.$id}#/$defs/message-sender` },
  ]);
  const from = { actorId: "depot", issue: "shipment" };
  for (const task of [
    null,
    { repository: "sample/records", number: 7 },
    { repository: "sample/records", number: 7, title: "Repaint the garden shed" },
  ])
    expect(validate!({ ...from, task })).toBe(true);
  for (const task of [
    { repository: "sample/records" },
    { number: 7 },
    { repository: "sample/records", number: 0 },
    { repository: "", number: 7 },
    { repository: "sample/records", number: 7, title: "" },
    { repository: "sample/records", number: 7, extra: true },
  ])
    expect(validate!({ ...from, task })).toBe(false);
  expect(validate!(from)).toBe(false);
});
