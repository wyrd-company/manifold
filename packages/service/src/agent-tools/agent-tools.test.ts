// ---
// relationships:
//   verifies: agent-tools
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { openEscalations } from "../escalations/index.ts";
import { serve, eventually } from "../escalations/test-support.ts";
import {
  isAgentToolCallResponse,
  agentToolsSchema,
  escalationContractSchema,
  serviceConfigurationSchemas,
} from "@wyrd-company/manifold-shared";
import { schemas } from "@wyrd-company/t3code-client";
import { fixtureThread } from "../t3code-source/test-fixtures/server.ts";
import { agentThreadTopic, openAgentTools } from "./index.ts";
const closing: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of closing.splice(0).toReversed()) await close();
});
async function fixture(
  options: { declared?: boolean; rejected?: boolean; available?: boolean } = {},
) {
  const store = openStore({ path: ":memory:" });
  let schema: "declared" | "unavailable" | "undeclared" = "declared";
  const validate = new Ajv2020({ allErrors: true }).compile({
    type: "object",
    required: ["handoff"],
    properties: {
      handoff: {
        type: "object",
        required: ["outcome"],
        properties: { outcome: { const: "sorted" } },
      },
    },
  });
  store.saveSnapshot({
    actorId: "parcel",
    machine: "sort",
    snapshot: { status: "active", value: "waiting" },
  });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({
        topics: [agentThreadTopic("station", "thread.a")],
        events:
          options.declared === false
            ? []
            : ["agent.handoff", "agent.escalated", "agent.escalation.answered"],
      }),
      restore: () => ({ status: "held", reason: "test hold" }),
    },
  });
  const sent: { messageId: string; text: string }[] = [];
  const tools = openAgentTools({
    store,
    configuration: { identifyTimeoutMs: 500 },
    environments: new Set(["station"]),
    router: () => router,
    actors: () => ({
      followers: () => ["parcel"],
      followedThreads: () => ["thread.a"],
      eventSchema: () =>
        schema === "declared" ? { status: schema, validate } : { status: schema },
    }),
    threads: {
      readThread: async () =>
        schemas.orchestrationReadModel.OrchestrationThread.parse({
          ...fixtureThread("thread.a"),
          session: {
            threadId: "thread.a",
            status: "running",
            providerName: "codex",
            runtimeMode: "full-access",
            activeTurnId: "turn-a",
            lastError: null,
            updatedAt: "2026-01-01T00:00:00Z",
          },
          latestTurn: {
            turnId: "turn-a",
            state: "running",
            requestedAt: "2026-01-01T00:00:00Z",
            startedAt: null,
            completedAt: null,
            assistantMessageId: null,
          },
          activities: [
            {
              id: "activity-a",
              tone: "tool",
              kind: "tool.started",
              turnId: "turn-a",
              summary: "handoff",
              payload: { toolCallId: "call-a" },
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        }),
      runningThreads: async () => [],
      startTurn: async (input) => {
        if (options.rejected) throw { kind: "rejected", message: "Rejected by fixture" };
        sent.push(input);
        return { sequence: 7 };
      },
    },
    environmentId: async () => {
      if (options.available === false) throw new Error("Unavailable");
      return "server-a";
    },
    escalations: () => escalations,
    log: () => {},
  });
  const escalations = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "held-actor": () => {},
      "stranded-token": () => {},
      "agent-question": tools.questionHandler,
    },
  });
  escalations.start();
  tools.start();
  const http = await serve(tools.requestListener);
  closing.push(async () => {
    await http.close();
    await tools.stop();
    await escalations.stop();
    router.stop();
    store.close();
  });
  const call = async (tool: string, args: unknown, meta: unknown = { callId: "call-a" }) => {
    const response = await fetch(http.url + "/api/agent-tools/calls", {
      method: "POST",
      body: JSON.stringify({ environment: "station", tool, arguments: args, meta }),
    });
    const body: unknown = await response.json();
    expect(isAgentToolCallResponse(body)).toBe(true);
    return { status: response.status, body };
  };
  return {
    url: http.url,
    store,
    tools,
    escalations,
    sent,
    call,
    schema: (value: typeof schema) => {
      schema = value;
    },
  };
}
test("handoff validates before accepting, retries once per turn, and keeps held inboxes", async () => {
  const f = await fixture();
  expect((await f.call("handoff", { handoff: { outcome: "unsorted" } })).status).toBe(422);
  expect(f.store.pendingInbox("parcel")).toHaveLength(0);
  const first = await f.call("handoff", { handoff: { outcome: "sorted" } });
  expect(first).toMatchObject({
    status: 200,
    body: {
      status: "accepted",
      replay: false,
      eventId: "station/server-a/thread%2Ea/turn/turn-a/handoff",
    },
  });
  expect((await f.call("handoff", { handoff: { outcome: "different" } })).body).toMatchObject({
    replay: true,
  });
  expect(f.store.pendingInbox("parcel")).toHaveLength(1);
});
test("unavailable held schema refuses without recording a call, then accepts after restore", async () => {
  const f = await fixture();
  f.schema("unavailable");
  expect((await f.call("handoff", { handoff: { outcome: "sorted" } })).body).toMatchObject({
    code: "task-held",
  });
  expect(f.store.pendingInbox("parcel")).toHaveLength(0);
  f.schema("declared");
  expect((await f.call("handoff", { handoff: { outcome: "sorted" } })).body).toMatchObject({
    replay: false,
  });
});
test("thread argument identifies a call without provider metadata", async () => {
  const f = await fixture();
  expect(
    (await f.call("handoff", { thread: "thread.a", handoff: { outcome: "sorted" } }, {})).status,
  ).toBe(200);
  expect((await f.call("handoff", { thread: "other", handoff: {} }, {})).body).toMatchObject({
    code: "not-followed",
  });
});
test("agent question and answer converge and placement precedes settlement", async () => {
  const f = await fixture();
  const first = await f.call("escalate", { question: "Which shelf?", freeText: true });
  expect(first).toMatchObject({ status: 200, body: { status: "raised", replay: false } });
  const id = (first.body as { escalationId: string }).escalationId;
  expect((await f.call("escalate", { question: "Again?", freeText: true })).body).toMatchObject({
    escalationId: id,
    replay: true,
  });
  f.escalations.answer(id, { text: "Upper shelf" }, "api");
  await eventually(() => expect(f.sent).toHaveLength(1));
  expect(f.sent[0]!.text).toContain("Upper shelf");
  f.tools.messagePlaced({
    environment: "station",
    threadId: "thread.a",
    messageId: f.sent[0]!.messageId,
    placement: "joined",
    turnId: "turn-a",
  });
  f.tools.messagePlaced({
    environment: "station",
    threadId: "thread.a",
    messageId: f.sent[0]!.messageId,
    placement: "started",
    turnId: "turn-b",
  });
  const events = f.store.pendingInbox("parcel").map((row) => row.payload);
  const eventAjv = new Ajv2020({ strict: false });
  for (const schema of serviceConfigurationSchemas) eventAjv.addSchema(schema);
  eventAjv.addSchema(escalationContractSchema);
  eventAjv.addSchema(agentToolsSchema);
  for (const event of events) {
    const type = (event as { type: string }).type;
    const fragment =
      type === "agent.escalated" ? "agent-escalated-event" : "agent-escalation-answered-event";
    expect(eventAjv.compile({ $ref: agentToolsSchema.$id + "#/$defs/" + fragment })(event)).toBe(
      true,
    );
  }
  expect(events).toHaveLength(2);
  expect(events[1]).toMatchObject({ type: "agent.escalation.answered", turnId: "turn-a" });
  expect(
    f.store.connection.database
      .prepare("SELECT turn_id FROM agenttool_answer WHERE escalation_id=?")
      .get(id)?.["turn_id"],
  ).toBe("turn-a");
});

test("refuses undeclared handoffs and rolls back the source event", async () => {
  const f = await fixture({ declared: false });
  expect((await f.call("handoff", { handoff: { outcome: "sorted" } })).body).toMatchObject({
    code: "not-accepted",
  });
  expect(
    f.store.connection.database.prepare("SELECT COUNT(*) AS n FROM router_source_event").get()?.[
      "n"
    ],
  ).toBe(0);
});
test("simultaneous provider calls in a turn accept one handoff", async () => {
  const f = await fixture();
  const results = await Promise.all([
    f.call("handoff", { handoff: { outcome: "sorted" } }, { "claudecode/toolUseId": "call-a" }),
    f.call("handoff", { handoff: { outcome: "sorted" } }),
  ]);
  expect(results.map((result) => (result.body as { replay: boolean }).replay).sort()).toEqual([
    false,
    true,
  ]);
  expect(f.store.pendingInbox("parcel")).toHaveLength(1);
});
test("rejects duplicate choices without raising or publishing", async () => {
  const f = await fixture();
  expect(
    (
      await f.call("escalate", {
        question: "Which shelf?",
        choices: [
          { id: "upper", label: "Upper" },
          { id: "upper", label: "Other" },
        ],
      })
    ).body,
  ).toMatchObject({ code: "invalid-escalation" });
  expect(f.escalations.list({})).toHaveLength(0);
  expect(f.store.pendingInbox("parcel")).toHaveLength(0);
});
test("withdraws an unanswered question when its actor ends", async () => {
  const f = await fixture();
  const result = await f.call("escalate", { question: "Which shelf?", freeText: true });
  const id = (result.body as { escalationId: string }).escalationId;
  f.tools.saving({
    actorId: "parcel",
    machine: "sort",
    snapshot: { status: "done", value: "sorted" },
    activeInvokes: [],
    entered: [],
    entries: {},
  });
  expect(f.escalations.answer(id, { text: "Upper" }, "api")).toMatchObject({
    status: "closed",
    escalation: { status: "withdrawn" },
  });
  expect(f.sent).toHaveLength(0);
});
test("rejected answer commands publish an answer with no turn and preserve the answer", async () => {
  const f = await fixture({ rejected: true });
  const result = await f.call("escalate", { question: "Which shelf?", freeText: true });
  const id = (result.body as { escalationId: string }).escalationId;
  f.escalations.answer(id, { text: "Upper" }, "api");
  await eventually(() => expect(f.store.pendingInbox("parcel")).toHaveLength(2));
  expect(f.store.pendingInbox("parcel")[1]!.payload).toMatchObject({
    type: "agent.escalation.answered",
    turnId: null,
  });
  expect(f.escalations.get(id)?.answer?.value).toEqual({ text: "Upper" });
});
test("unknown placement is recorded once with a null turn", async () => {
  const f = await fixture();
  const result = await f.call("escalate", { question: "Which shelf?", freeText: true });
  const id = (result.body as { escalationId: string }).escalationId;
  f.escalations.answer(id, { text: "Upper" }, "api");
  await eventually(() => expect(f.sent).toHaveLength(1));
  f.tools.messagePlaced({
    environment: "station",
    threadId: "thread.a",
    messageId: f.sent[0]!.messageId,
    placement: "unknown",
    turnId: null,
  });
  expect(f.store.pendingInbox("parcel")[1]!.payload).toMatchObject({ turnId: null });
});
test("endpoint rejects malformed, unknown and oversized requests", async () => {
  const f = await fixture();
  const response = async (path: string, method: string, body?: string) =>
    fetch(f.url + path, { method, ...(body !== undefined ? { body } : {}) });
  expect((await response("/api/agent-tools/nope", "POST", "{}")).status).toBe(404);
  expect((await response("/api/agent-tools/calls", "GET")).status).toBe(405);
  expect((await response("/api/agent-tools/calls", "POST", "{")).status).toBe(400);
  expect(
    (
      await response(
        "/api/agent-tools/calls",
        "POST",
        JSON.stringify({
          environment: "unknown",
          tool: "handoff",
          arguments: { handoff: {} },
          meta: {},
        }),
      )
    ).status,
  ).toBe(404);
  expect(
    (await response("/api/agent-tools/calls", "POST", "x".repeat(1024 * 1024 + 1))).status,
  ).toBe(413);
  expect(f.store.pendingInbox("parcel")).toHaveLength(0);
});
test("an unavailable environment refuses the call without writing", async () => {
  const f = await fixture({ available: false });
  expect((await f.call("handoff", { handoff: { outcome: "sorted" } })).body).toMatchObject({
    code: "environment-unavailable",
  });
  expect(f.store.pendingInbox("parcel")).toHaveLength(0);
});
