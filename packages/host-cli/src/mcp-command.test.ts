// ---
// relationships:
//   verifies: [host-cli-mcp, agent-tools]
// ---
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import {
  agentToolDefinitions,
  agentToolsSchema,
  serviceConfigurationSchemas,
  escalationContractSchema,
} from "@wyrd-company/manifold-shared";

let directory = "";
let binary = "";
beforeAll(() => {
  mkdirSync(resolve("node_modules/.cache"), { recursive: true });
  directory = mkdtempSync(resolve("node_modules/.cache/mcp-build-"));
  binary = join(directory, "manifold-host");
  const build = spawnSync(
    "bun",
    ["build", "src/cli.ts", "src/hook/worker.ts", "--compile", "--bytecode", "--outfile", binary],
    { encoding: "utf8" },
  );
  expect(build.status, build.stderr).toBe(0);
}, 30000);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function connect(service: string) {
  const child = spawn(
    binary,
    ["mcp", "--service", service, "--environment", "workstation", "--request-timeout-ms", "1000"],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  const exited = once(child, "exit");
  const lines: string[] = [];
  let errors = "";
  child.stderr.on("data", (data) => {
    errors += String(data);
  });
  const transport: Transport = {
    async start() {
      createInterface({ input: child.stdout }).on("line", (line) => {
        lines.push(line);
        transport.onmessage?.(JSON.parse(line));
      });
    },
    async send(message) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    },
    async close() {
      child.stdin.end();
      await exited;
      transport.onclose?.();
    },
  };
  return {
    client: new Client({ name: "parcel-test", version: "1" }),
    transport,
    exited,
    lines,
    errors: () => errors,
  };
}

test("compiled stdio MCP forwards each call once and handles service responses and failures", async () => {
  const requests: unknown[] = [];
  const headers: unknown[] = [];
  let mode = "accepted";
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += String(chunk);
    requests.push(JSON.parse(body));
    headers.push(req.headers);
    expect([req.method, req.url]).toEqual(["POST", "/api/agent-tools/calls"]);
    if (mode === "timeout") return;
    res.setHeader("Content-Type", "application/json");
    if (mode === "raised") {
      res.end(
        JSON.stringify({
          status: "raised",
          replay: true,
          escalationId: "abcdefghijklmnopqrstuv",
          threadId: "thread-one",
          turnId: "turn-one",
          message: "Question sent; end your turn.",
        }),
      );
      return;
    }
    if (mode === "malformed") {
      res.end("{}");
      return;
    }
    if (mode === "refused") {
      res.statusCode = 409;
      res.end(
        JSON.stringify({
          status: "refused",
          code: "not-followed",
          message: "The thread is not followed.",
        }),
      );
      return;
    }
    res.end(
      JSON.stringify({
        status: "accepted",
        replay: false,
        eventId: "event-one",
        threadId: "thread-one",
        turnId: "turn-one",
        message: "Handoff taken; end your turn.",
      }),
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No port");
  const session = connect(`http://127.0.0.1:${address.port}`);
  try {
    await session.client.connect(session.transport);
    expect((await session.client.listTools()).tools).toEqual(agentToolDefinitions);
    const accepted = await session.client.callTool({
      name: "handoff",
      arguments: { handoff: { outcome: "done" }, thread: "thread-one" },
      _meta: { callId: "call-one" },
    });
    expect(accepted).toMatchObject({
      content: [{ type: "text", text: "Handoff taken; end your turn." }],
      structuredContent: { status: "accepted" },
      isError: false,
    });
    expect(requests[0]).toEqual({
      environment: "workstation",
      tool: "handoff",
      arguments: { handoff: { outcome: "done" }, thread: "thread-one" },
      meta: { callId: "call-one" },
    });
    expect(headers[0]).toMatchObject({ "content-type": "application/json" });
    expect(headers[0]).not.toHaveProperty("authorization");
    mode = "refused";
    expect(
      await session.client.callTool({
        name: "escalate",
        arguments: { question: "Where should it go?", freeText: true },
      }),
    ).toMatchObject({ isError: true, structuredContent: { code: "not-followed" } });
    expect(requests[1]).toEqual({
      environment: "workstation",
      tool: "escalate",
      arguments: { question: "Where should it go?", freeText: true },
      meta: {},
    });
    mode = "raised";
    expect(
      await session.client.callTool({
        name: "escalate",
        arguments: { question: "Where should it go?", freeText: true },
      }),
    ).toMatchObject({ isError: false, structuredContent: { status: "raised", replay: true } });
    mode = "malformed";
    expect(
      await session.client.callTool({ name: "handoff", arguments: { handoff: null } }),
    ).toMatchObject({
      isError: true,
      structuredContent: {
        code: "service-unreachable",
        message: expect.stringContaining("same turn"),
      },
    });
    mode = "timeout";
    expect(
      await session.client.callTool({ name: "handoff", arguments: { handoff: null } }),
    ).toMatchObject({ isError: true, structuredContent: { code: "service-unreachable" } });
    server.closeAllConnections();
    server.close();
    await once(server, "close");
    expect(
      await session.client.callTool({ name: "handoff", arguments: { handoff: null } }),
    ).toMatchObject({ isError: true, structuredContent: { code: "service-unreachable" } });
    expect(requests).toHaveLength(5);
    const ajv = new Ajv2020({ strict: false });
    for (const schema of serviceConfigurationSchemas) ajv.addSchema(schema);
    ajv.addSchema(escalationContractSchema);
    ajv.addSchema(agentToolsSchema);
    const validate = ajv.compile({ $ref: `${agentToolsSchema.$id}#/$defs/call-request` });
    for (const request of requests)
      expect(validate(request), JSON.stringify(validate.errors)).toBe(true);
    await session.client.close();
    expect(await session.exited).toEqual([0, null]);
    expect(session.lines.length).toBeGreaterThan(5);
    for (const line of session.lines) expect(JSON.parse(line)).toHaveProperty("jsonrpc", "2.0");
    expect(session.errors()).toContain("service-unreachable");
  } finally {
    await session.client.close();
    server.closeAllConnections();
    server.close();
  }
}, 15000);

test.each([
  ["--unknown"],
  ["--environment", "workstation"],
  ["--service", "http://127.0.0.1"],
  ["--service", "http://127.0.0.1", "--environment", "Invalid"],
  ["--service", "file:///tmp", "--environment", "workstation"],
  ["--service", "http://127.0.0.1", "--environment", "workstation", "--request-timeout-ms", "999"],
  [
    "--service",
    "http://127.0.0.1",
    "--service",
    "http://127.0.0.2",
    "--environment",
    "workstation",
  ],
])("invalid MCP command %j exits two before serving", (...args) => {
  const result = spawnSync(binary, ["mcp", ...args], { encoding: "utf8" });
  expect([result.status, result.stdout]).toEqual([2, ""]);
  expect(result.stderr.length).toBeGreaterThan(0);
});
