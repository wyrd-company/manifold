// ---
// relationships:
//   implements: [host-cli-mcp, agent-tools]
// ---
import { parseArgs } from "node:util";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import {
  agentToolDefinitions,
  isAgentToolCallResponse,
  serviceConfigurationSchema,
} from "@wyrd-company/manifold-shared";
import type { AgentToolCallResponse } from "@wyrd-company/manifold-shared";

function options(args: string[]) {
  const parsed = parseArgs({
    args,
    strict: true,
    allowPositionals: false,
    tokens: true,
    options: {
      service: { type: "string" },
      environment: { type: "string" },
      "request-timeout-ms": { type: "string" },
    },
  });
  const seen = new Set<string>();
  for (const token of parsed.tokens)
    if (token.kind === "option") {
      if (seen.has(token.name)) throw Error(`Option --${token.name} cannot be repeated`);
      seen.add(token.name);
    }
  if (!parsed.values.service) throw Error("--service is required");
  const service = new URL(parsed.values.service);
  if (!["http:", "https:"].includes(service.protocol))
    throw Error("--service must be an http or https URL");
  const environment = parsed.values.environment;
  const declaredName = serviceConfigurationSchema.$defs["declared-name"];
  if (
    !environment ||
    environment.length > declaredName.maxLength ||
    !new RegExp(declaredName.pattern).test(environment)
  )
    throw Error("--environment must be a declared name");
  const rawTimeout = parsed.values["request-timeout-ms"] ?? "30000";
  const requestTimeoutMs = Number(rawTimeout);
  if (
    !/^\d+$/.test(rawTimeout) ||
    !Number.isInteger(requestTimeoutMs) ||
    requestTimeoutMs < 1000 ||
    requestTimeoutMs > 300000
  )
    throw Error("--request-timeout-ms must be an integer from 1000 to 300000");
  return { service: service.href.replace(/\/$/, ""), environment, requestTimeoutMs };
}

export async function mcpCommand(args: string[]) {
  let config: ReturnType<typeof options>;
  try {
    config = options(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  const server = new Server(
    { name: "manifold", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  const stopped = new AbortController();
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: agentToolDefinitions }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!agentToolDefinitions.some((tool) => tool.name === request.params.name))
      throw new McpError(ErrorCode.InvalidParams, "Unknown tool");
    let answer: AgentToolCallResponse;
    try {
      const response = await fetch(`${config.service}/api/agent-tools/calls`, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          environment: config.environment,
          tool: request.params.name,
          arguments: request.params.arguments ?? {},
          meta: request.params._meta ?? {},
        }),
        signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(config.requestTimeoutMs)]),
      });
      const body: unknown = await response.json();
      if (!isAgentToolCallResponse(body)) throw Error("Service returned an invalid call response");
      answer = body;
    } catch {
      answer = {
        status: "refused",
        code: "service-unreachable",
        message:
          "The service could not be reached. The call may have been taken; calling this tool again in the same turn is safe.",
      };
    }
    if (answer.status === "refused") process.stderr.write(`${answer.code}: ${answer.message}\n`);
    return {
      content: [{ type: "text" as const, text: answer.message }],
      structuredContent: answer,
      isError: answer.status === "refused",
    };
  });
  // eslint-disable-next-line unicorn/prefer-add-event-listener -- The MCP SDK exposes an error callback, not EventTarget.
  server.onerror = (error) => process.stderr.write(`${error.message}\n`);
  const ended = new Promise<void>((resolve) =>
    process.stdin.once("end", () => {
      stopped.abort();
      resolve();
    }),
  );
  await server.connect(new StdioServerTransport());
  await ended;
  await server.close();
  return 0;
}
