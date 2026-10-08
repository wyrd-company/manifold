// ---
// relationships:
//   verifies: agent-tools
// ---
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { afterEach, expect, test } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { openEscalations } from "../escalations/index.ts";
import { serve, eventually, readRequest } from "../escalations/test-support.ts";
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
  const notifications: { title: string; click?: string }[] = [];
  const ntfy = await serve((req, res) => {
    void readRequest(req).then((body) => {
      notifications.push(JSON.parse(body) as { title: string; click?: string });
      res.end("{}");
    });
  });
  closing.push(ntfy.close);
  let issue: { repository: string; number: number; title?: string } | undefined;
  const issueReads: string[] = [];
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
            : ["agent.handoff", "agent.escalated", "agent.escalation.answered", "agent.message"],
      }),
      restore: () => ({ status: "held", reason: "test hold" }),
    },
  });
  const sent: { messageId: string; text: string }[] = [];
  let reads = 0;
  let ready = true;
  let finishRead: (() => void) | undefined;
  let holdReads = false;
  let readSignal: AbortSignal | undefined;
  const tools = openAgentTools({
    store,
    configuration: { identifyTimeoutMs: 500 },
    environments: new Set(["station"]),
    router: () => router,
    actors: () => ({
      followers: (_environment, threadId) => (threadId === "thread.a" ? ["parcel"] : []),
      issueThreads: () => [{ actorId: "parcel", environment: "station", threadId: "thread.a" }],
      actorOf: () => ({ manifold: { issue: "shipment" }, commit: "a".repeat(40) }),
      followedThreads: () => ["thread.a"],
      eventSchema: () =>
        schema === "declared" ? { status: schema, validate } : { status: schema },
    }),
    threads: {
      readThread: async (_environment, _threadId, signal) => {
        reads++;
        readSignal = signal;
        if (holdReads)
          await new Promise<void>((resolve) => {
            finishRead = resolve;
          });
        return schemas.orchestrationReadModel.OrchestrationThread.parse({
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
        });
      },
      runningThreads: async () => [],
      startTurn: async (input) => {
        if (options.rejected) throw { kind: "rejected", message: "Rejected by fixture" };
        sent.push(input);
        return { sequence: 7 };
      },
    },
    sourceReady: () => ready,
    trackedIssue: (nodeId: string) => {
      issueReads.push(nodeId);
      return issue;
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
    configuration: {
      publicUrl: "http://localhost",
      destinations: {
        default: { server: ntfy.url, topic: "parcel-questions", posture: "open", priority: 4 },
      },
      requestTimeoutMs: 30000,
      retryIntervalMs: 60000,
    },
    tokenFile: () => "",
    handlers: {
      "held-actor": () => {},
      "stranded-token": () => {},
      "agent-question": tools.questionHandler,
    },
  });
  escalations.start();
  tools.start();
  const http = await serve((req, res) => {
    if (req.url?.startsWith("/escalations/")) escalations.requestListener(req, res);
    else tools.requestListener(req, res);
  });
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
    notifications,
    issueReads,
    issue(value: typeof issue, nodeId: string | undefined = "I_PARCEL") {
      issue = value;
      store.saveSnapshot({
        actorId: "parcel",
        machine: "sort",
        snapshot: {
          status: "active",
          value: "waiting",
          context: { manifold: { issue: nodeId } },
        },
      });
    },
    url: http.url,
    reads: () => reads,
    ready: (value: boolean) => {
      ready = value;
    },
    holdReads: () => {
      holdReads = true;
    },
    readSignal: () => readSignal,
    finishRead: () => {
      holdReads = false;
      finishRead?.();
    },
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

test("messages are invisible until delivery, reads append late mail, notices count once", async () => {
  const f = await fixture();
  const db = f.store.connection.database;
  const insert = db.prepare(
    "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at) VALUES (?, 'station', 'thread.a', 'depot', ?, 0)",
  );
  const older = "00000000-0000-4000-8000-000000000001";
  const newer = "00000000-0000-4000-8000-000000000002";
  insert.run(older, "Older parcel");
  insert.run(newer, "Newer parcel");
  expect((await f.call("get-messages", {})).body).toMatchObject({
    status: "read",
    messages: [],
    message: "You have no messages.",
  });
  function deliver(id: string) {
    f.tools.saving({
      actorId: "parcel",
      machine: "sort",
      snapshot: { status: "active", value: "waiting" },
      activeInvokes: [],
      entered: [],
      entries: {},
      eventId: "agent:message/" + id,
    });
  }
  const notice = async (body: unknown = { environment: "station", threadId: "thread.a" }) => {
    const response = await fetch(f.url + "/api/agent-tools/notices", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  expect(await notice()).toMatchObject({ status: 200, body: { notice: null } });
  deliver(newer);
  expect(await notice({ environment: "station", callId: "call-a" })).toMatchObject({
    status: 200,
    body: { notice: expect.stringContaining("1 new message") },
  });
  const beforeNotice = f.reads();
  expect(await notice({ environment: "station", callId: "call-a" })).toMatchObject({
    body: { notice: null },
  });
  expect(f.reads()).toBe(beforeNotice);
  expect(await notice()).toMatchObject({ body: { notice: null } });
  const first = await f.call("get-messages", {});
  expect(first.body).toMatchObject({
    status: "read",
    messages: [{ messageId: newer, text: "Newer parcel" }],
  });
  expect(await f.call("get-messages", {})).toEqual(first);
  deliver(older);
  const second = await f.call("get-messages", {});
  expect(second.body).toMatchObject({ messages: [{ messageId: newer }, { messageId: older }] });
  expect((second.body as { message: string }).message).toBe(
    "You have 2 messages.\n\nMessage 1 of 2, from task `depot`, sent 1970-01-01T00:00:00.000Z:\n\nNewer parcel\n\nMessage 2 of 2, from task `depot`, sent 1970-01-01T00:00:00.000Z:\n\nOlder parcel",
  );
  expect(await notice()).toMatchObject({ body: { notice: null } });
  expect((await f.call("get-messages", { thread: "other" }, {})).body).toMatchObject({
    code: "not-followed",
  });
  expect(await notice({ environment: "station", threadId: "other" })).toMatchObject({
    body: { notice: null },
  });
  expect(await notice({ environment: "unknown", threadId: "thread.a" })).toMatchObject({
    status: 404,
  });
  expect(await notice({ environment: "station" })).toMatchObject({ status: 400 });
});

test("only a declared delivery save sets the first message receipt", async () => {
  const f = await fixture();
  const id = "00000000-0000-4000-8000-000000000003";
  f.store.connection.database
    .prepare(
      "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at) VALUES (?, 'station', 'thread.a', 'depot', 'Parcel', 0)",
    )
    .run(id);
  const save: Parameters<typeof f.tools.saving>[0] = {
    actorId: "parcel",
    machine: "sort",
    snapshot: { status: "active", value: "waiting" },
    activeInvokes: [],
    entered: [],
    entries: {},
  };
  f.tools.saving(save);
  expect((await f.call("get-messages", {})).body).toMatchObject({ messages: [] });
  f.schema("undeclared");
  f.tools.saving({ ...save, eventId: "agent:message/" + id });
  expect((await f.call("get-messages", {})).body).toMatchObject({ messages: [] });
  f.schema("declared");
  f.tools.saving({ ...save, eventId: "agent:message/" + id });
  f.tools.saving({ ...save, actorId: "other", eventId: "agent:message/" + id });
  expect(
    f.store.connection.database
      .prepare("SELECT delivered_to FROM agenttool_message WHERE message_id=?")
      .get(id)!["delivered_to"],
  ).toBe("parcel");
});

test("a not-ready notice source keeps mail unmarked until a ready request", async () => {
  const f = await fixture();
  const db = f.store.connection.database;
  db.prepare(
    "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to) VALUES (?, 'station', 'thread.a', 'depot', 'A parcel arrived', 0, 1, 'parcel')",
  ).run("00000000-0000-4000-8000-000000000001");
  const notice = async () => {
    const response = await fetch(f.url + "/api/agent-tools/notices", {
      method: "POST",
      body: JSON.stringify({ environment: "station", callId: "call-a" }),
    });
    return response.json();
  };
  f.ready(false);
  expect(await notice()).toEqual({ notice: null });
  expect(f.reads()).toBe(0);
  expect(db.prepare("SELECT noticed_at FROM agenttool_message").get()!["noticed_at"]).toBeNull();
  f.ready(true);
  expect(await notice()).toEqual({ notice: expect.stringContaining("1 new message") });
  expect(f.reads()).toBe(1);
  expect(
    db.prepare("SELECT noticed_at FROM agenttool_message").get()!["noticed_at"],
  ).not.toBeNull();
});

test("a disconnected notice request keeps mail unmarked after its read completes", async () => {
  const f = await fixture();
  const db = f.store.connection.database;
  db.prepare(
    "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,text,sent_at,delivered_at,delivered_to) VALUES (?, 'station', 'thread.a', 'depot', 'A parcel arrived', 0, 1, 'parcel')",
  ).run("00000000-0000-4000-8000-000000000001");
  f.holdReads();
  const controller = new AbortController();
  const abandoned = fetch(f.url + "/api/agent-tools/notices", {
    method: "POST",
    body: JSON.stringify({ environment: "station", callId: "call-a" }),
    signal: controller.signal,
  }).catch(() => undefined);
  try {
    await eventually(() => expect(f.reads()).toBe(1));
    controller.abort();
    await abandoned;
    await eventually(() => expect(f.readSignal()?.aborted).toBe(true));
  } finally {
    f.finishRead();
  }
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(db.prepare("SELECT noticed_at FROM agenttool_message").get()!["noticed_at"]).toBeNull();
  const response = await fetch(f.url + "/api/agent-tools/notices", {
    method: "POST",
    body: JSON.stringify({ environment: "station", callId: "call-a" }),
  });
  expect(await response.json()).toEqual({ notice: expect.stringContaining("1 new message") });
});
test.each([undefined, "Paint colour"])(
  "question title %s names the tracked task on every channel and survives replay",
  async (title) => {
    const f = await fixture();
    f.issue({ repository: "example-org/widgets", number: 7, title: "Repaint the garden shed" });
    const args = {
      question: "Which colour?",
      choices: [{ id: "blue", label: "Blue" }],
      freeText: true,
      ...(title ? { title } : {}),
    };
    const first = await f.call("escalate", args);
    expect(first.status).toBe(200);
    const id = (first.body as { escalationId: string }).escalationId;
    const expected = title
      ? "example-org/widgets#7: Paint colour — Repaint the garden shed"
      : "example-org/widgets#7: Repaint the garden shed";
    expect(f.escalations.get(id)?.title).toBe(expected);
    expect(f.store.pendingInbox("parcel")[0]!.payload).toMatchObject({
      type: "agent.escalated",
      title: expected,
    });
    await eventually(() => expect(f.notifications).toHaveLength(1));
    expect(f.notifications[0]!.title).toBe(expected);
    const click = new URL(f.notifications[0]!.click!);
    const page = await fetch(f.url + click.pathname + click.search);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain(expected);
    f.issue({ repository: "example-org/widgets", number: 7, title: "Changed issue title" });
    expect((await f.call("escalate", { ...args, title: "Changed question" })).body).toMatchObject({
      escalationId: id,
      replay: true,
    });
    expect(f.issueReads).toEqual(["I_PARCEL"]);
    expect(f.escalations.get(id)?.title).toBe(expected);
    f.escalations.answer(
      id,
      title ? { choice: "blue" } : { text: "Use blue.\nKeep the trim white." },
      "api",
    );
    await eventually(() => expect(f.sent).toHaveLength(1));
    expect(f.sent[0]!.text).toBe(
      title
        ? "Your question was answered: Blue (choice `blue`).\n\nContinue your work with this answer."
        : "Your question was answered:\n\nUse blue.\nKeep the trim white.\n\nContinue your work with this answer.",
    );
  },
);

test.each(["missing identity", "untracked issue"])(
  "question with %s keeps the fallback",
  async (kind) => {
    const f = await fixture();
    if (kind === "untracked issue") f.issue(undefined);
    const result = await f.call("escalate", { question: "Which colour?", freeText: true });
    expect(f.escalations.get((result.body as { escalationId: string }).escalationId)?.title).toBe(
      "Question",
    );
    expect(f.issueReads).toEqual(kind === "untracked issue" ? ["I_PARCEL"] : []);
  },
);

test.each(["held-actor", "stranded-token", "intake-failed", "comparator-failed"] as const)(
  "service escalation %s keeps its supplied title",
  async (kind) => {
    const f = await fixture();
    f.issue({ repository: "example-org/widgets", number: 7, title: "Repaint the garden shed" });
    const question = f.escalations.raise({
      kind,
      subject: { actorId: "parcel" },
      title: "Delivery needs attention",
      question: "Which shelf?",
      choices: [],
      freeText: true,
    });
    expect(question.title).toBe("Delivery needs attention");
    await eventually(() => expect(f.notifications).toHaveLength(1));
    expect(f.notifications[0]!.title).toBe("Delivery needs attention");
    expect(f.issueReads).toEqual([]);
  },
);

test("agent tools migration agrees with the declared DDL and runs once", async () => {
  const f = await fixture();
  const db = f.store.connection.database;
  const declared = new DatabaseSync(":memory:");
  try {
    declared.exec(
      readFileSync(
        new URL("../../../../docs/specifications/agent-tools-database-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    const query =
      "SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name GLOB 'agenttool_*' ORDER BY name";
    const rows = (database: DatabaseSync) =>
      database
        .prepare(query)
        .all()
        .map((row) => ({ ...row, sql: String(row["sql"]).replace(/\s+/g, " ") }));
    expect(rows(db)).toEqual(rows(declared));
    expect(
      db.prepare("SELECT version FROM schema_migration WHERE owner='agenttool'").get()!["version"],
    ).toBe(3);
  } finally {
    declared.close();
  }
});

test.each([
  [null, "sample/records", 7, null],
  ["shipment", "sample/records", null, null],
  ["shipment", null, 7, null],
  ["shipment", null, null, "Repaint the garden shed"],
  ["shipment", "", 7, null],
  ["shipment", "sample/records", 0, null],
  ["shipment", "sample/records", 7, ""],
])(
  "message storage rejects a partial or empty sender: %j %j %j %j",
  async (issue, repository, number, title) => {
    const f = await fixture();
    expect(() =>
      f.store.connection.database
        .prepare(
          "INSERT INTO agenttool_message(message_id,environment,thread_id,sender_actor_id,sender_issue,text,sent_at,sender_repository,sender_number,sender_title) VALUES (?, 'station', 'thread.a', 'depot', ?, 'A parcel arrived', 0, ?, ?, ?)",
        )
        .run("a".repeat(36), issue, repository, number, title),
    ).toThrow(/CHECK constraint failed/);
  },
);
