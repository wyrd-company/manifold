// ---
// relationships:
//   implements: agent-tools
// ---
import { createSchemaCompiler } from "./schema-compiler.ts";
import { agentToolsSchema } from "./agent-tools-schema.ts";
import { escalationContractSchema } from "./escalation-contract-schema.ts";

// MCP consumers need self-contained input schemas, with no remote references.
export const agentToolDefinitions = [
  {
    name: "handoff",
    description:
      "Hand your work back to your task. Call once at the end of your work, then end your turn. Pass thread when the prompt names the T3 Code thread id.",
    inputSchema: {
      ...agentToolsSchema.$defs["handoff-input"],
      properties: {
        ...agentToolsSchema.$defs["handoff-input"].properties,
        thread: agentToolsSchema.$defs["thread-argument"],
      },
    },
  },
  {
    name: "escalate",
    description:
      "Ask a person a question. Call once at the end of your work, then end your turn. The answer arrives as a new message in your thread. Pass thread when the prompt names the T3 Code thread id.",
    inputSchema: {
      ...agentToolsSchema.$defs["escalate-input"],
      properties: {
        ...agentToolsSchema.$defs["escalate-input"].properties,
        thread: agentToolsSchema.$defs["thread-argument"],
        choices: {
          ...escalationContractSchema.$defs.choices,
          items: escalationContractSchema.$defs.choice,
          default: [],
        },
      },
    },
  },
] as const;

export type AgentToolCallResponse =
  | {
      status: "accepted";
      replay: boolean;
      eventId: string;
      threadId: string;
      turnId: string;
      message: string;
    }
  | {
      status: "raised";
      replay: boolean;
      escalationId: string;
      threadId: string;
      turnId: string;
      message: string;
    }
  | {
      status: "refused";
      code: (typeof agentToolsSchema.$defs)["refusal-code"]["enum"][number];
      message: string;
      issues?: { path: string; message: string }[];
    };

let responseValidator: ((value: unknown) => boolean) | undefined;
export function isAgentToolCallResponse(value: unknown): value is AgentToolCallResponse {
  responseValidator ??= createSchemaCompiler()([
    { $ref: `${agentToolsSchema.$id}#/$defs/call-response` },
  ])[0]!;
  return responseValidator(value);
}
