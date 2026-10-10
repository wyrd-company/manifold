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
  {
    name: "get-messages",
    description:
      "Read messages other tasks send to your thread. A notice tells you when one arrives. Read them when your current step is done; you may also call between notices. Do not end your turn to read them. Pass thread when the prompt names the T3 Code thread id.",
    inputSchema: {
      ...agentToolsSchema.$defs["get-messages-input"],
      properties: { thread: agentToolsSchema.$defs["thread-argument"] },
    },
  },
] as const;

export type AgentTaskContext = {
  readonly repository: string;
  readonly number: number;
  readonly title?: string;
};

export interface ThreadMessage {
  messageId: string;
  from: { actorId: string; issue: string | null; task: AgentTaskContext | null };
  text: string;
  sentAt: string;
  deliveredAt: string;
}

export type AgentToolCallResponse =
  | { status: "read"; threadId: string; turnId: string; messages: ThreadMessage[]; message: string }
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
