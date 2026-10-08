// ---
// relationships:
//   verifies: [agent-tools, durable-event-delivery, agent-threads]
// ---
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { fork } from "node:child_process";
import { once } from "node:events";
import { afterEach, expect, test } from "vite-plus/test";
import { DatabaseSync } from "node:sqlite";
import { githubFake } from "../github-source/test-fixtures/api.ts";
import { schemas } from "@wyrd-company/t3code-client";
import { fakeServer, fixtureThread } from "../t3code-source/test-fixtures/server.ts";
import { recoveryService } from "./test-fixtures/recovery-service.ts";
import type { RecoveryConfiguration } from "./test-fixtures/recovery-service.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function fixture(joined = false) {
  const directory = await mkdtemp(join(tmpdir(), "agent-tool-recovery-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const token = join(directory, "token");
  await writeFile(token, "fixture-token");
  const server = await fakeServer();
  cleanup.push(() => server.close());
  const base = fixtureThread("conversation");
  const thread = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...base,
    latestTurn: {
      turnId: "asking-turn",
      state: joined ? "running" : "completed",
      requestedAt: base.createdAt,
      startedAt: base.createdAt,
      completedAt: joined ? null : base.createdAt,
      assistantMessageId: null,
    },
    session: {
      threadId: base.id,
      status: "running",
      activeTurnId: "asking-turn",
      providerName: "codex",
      runtimeMode: base.runtimeMode,
      updatedAt: base.createdAt,
      lastError: null,
    },
  });
  server.baseline(thread);
  const receipts = new Map<string, number>();
  server.hooks.dispatch = (raw) => {
    const command = schemas.orchestrationCommands.ClientOrchestrationCommand.parse(raw);
    if (command.type !== "thread.turn.start") throw new Error("Unexpected command");
    const previous = receipts.get(command.commandId);
    if (previous !== undefined) return { sequence: previous };
    const message = schemas.orchestrationReadModel.OrchestrationMessage.parse({
      id: command.message.messageId,
      role: "user",
      turnId: null,
      streaming: false,
      text: command.message.text,
      attachments: [],
      createdAt: command.createdAt,
      updatedAt: command.createdAt,
    });
    thread.messages.push(message);
    server.change(thread, "thread.message-sent", {
      threadId: thread.id,
      ...message,
      messageId: message.id,
    });
    if (!joined) {
      thread.latestTurn = {
        turnId: schemas.common.TurnId.parse("answer-turn"),
        state: "running",
        requestedAt: command.createdAt,
        startedAt: command.createdAt,
        completedAt: null,
        assistantMessageId: null,
      };
      thread.session = { ...thread.session!, activeTurnId: thread.latestTurn.turnId };
      server.change(thread);
    }
    const sequence = server.log.length;
    receipts.set(command.commandId, sequence);
    return { sequence };
  };
  const config: RecoveryConfiguration = {
    path: join(directory, "store.sqlite"),
    token,
    environments: {
      station: {
        url: server.url,
        credential: "writer",
        reconnect: { initialMs: 1, factor: 2, maxMs: 5, jitter: 0 },
        heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
        openTimeoutMs: 10000,
      },
    },
  };
  function settle() {
    thread.latestTurn = {
      ...thread.latestTurn!,
      state: "completed",
      completedAt: new Date().toISOString(),
    };
    thread.session = { ...thread.session!, status: "ready", activeTurnId: null };
    server.change(thread);
  }
  return { config, server, thread, receipts, settle };
}
test.each([false, true])(
  "answer placement drives the following actor's settlement (joined=%s)",
  async (joined) => {
    const f = await fixture(joined);
    const service = await recoveryService(f.config);
    cleanup.push(() => service.stop());
    const question = await service.call("escalate", {
      thread: "conversation",
      question: "Which shelf?",
      freeText: true,
    });
    expect(question).toMatchObject({ status: "raised" });
    service.escalations.answer(String(question["escalationId"]), { text: "Upper shelf" }, "api");
    await expect
      .poll(() => service.snapshot()["context"])
      .toMatchObject({ answers: 1, answerTurn: joined ? "asking-turn" : "answer-turn" });
    expect(f.thread.messages).toHaveLength(1);
    expect(f.thread.messages[0]!.text).toContain("Upper shelf");
    f.settle();
    await expect.poll(() => service.snapshot().status).toBe("done");
  },
);
function worker(config: RecoveryConfiguration) {
  const child = fork(
    new URL("./test-fixtures/recovery-worker.ts", import.meta.url),
    [JSON.stringify(config)],
    { execArgv: [], stdio: ["ignore", "pipe", "pipe", "ipc"] },
  );
  let stderr = "";
  child.stderr?.on("data", (data) => {
    stderr += String(data);
  });
  const messages: Record<string, unknown>[] = [];
  child.on("message", (message) => messages.push(message as Record<string, unknown>));
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  });
  async function ready() {
    await expect
      .poll(
        () => {
          if (child.exitCode !== null) throw new Error(stderr);
          return messages.some((message) => message["kind"] === "ready");
        },
        { timeout: 10000 },
      )
      .toBe(true);
  }
  return { child, messages, ready, error: () => stderr };
}
test("SIGKILL after handoff commit restores one transition and a replay", async () => {
  const f = await fixture(true);
  const crash = worker({ ...f.config, crash: "handoff" });
  await crash.ready();
  const exited = once(crash.child, "exit");
  crash.child.send({
    kind: "call",
    tool: "handoff",
    args: { thread: "conversation", handoff: { outcome: "sorted" } },
  });
  expect(await exited, crash.error()).toEqual([null, "SIGKILL"]);
  const resumed = await recoveryService(f.config);
  cleanup.push(() => resumed.stop());
  await expect.poll(() => resumed.snapshot()["context"]).toMatchObject({ handoffs: 1 });
  expect(
    await resumed.call("handoff", { thread: "conversation", handoff: { outcome: "other" } }),
  ).toMatchObject({ status: "accepted", replay: true });
  expect(resumed.snapshot()["context"]).toMatchObject({ handoffs: 1 });
});
test.each([
  ["answer-committed", false],
  ["answer-sent", false],
  ["answer-committed", true],
  ["answer-sent", true],
] as const)(
  "SIGKILL at %s resumes one answer and its turn (joined=%s)",
  async (crashMode, joined) => {
    const f = await fixture(joined);
    const crash = worker({ ...f.config, crash: crashMode });
    await crash.ready();
    crash.child.send({
      kind: "call",
      tool: "escalate",
      args: { thread: "conversation", question: "Which shelf?", freeText: true },
    });
    await expect
      .poll(() => crash.messages.find((message) => message["kind"] === "call"))
      .toBeDefined();
    const question = crash.messages.find((message) => message["kind"] === "call")![
      "result"
    ] as Record<string, unknown>;
    expect(question).toMatchObject({ status: "raised" });
    if (crashMode === "answer-sent") f.server.hooks.deliverThreadItems = () => false;
    const exited = once(crash.child, "exit");
    crash.child.send({ kind: "answer", escalationId: question["escalationId"] });
    expect(await exited, crash.error()).toEqual([null, "SIGKILL"]);
    delete f.server.hooks.deliverThreadItems;
    const resumed = await recoveryService(f.config);
    cleanup.push(() => resumed.stop());
    await expect
      .poll(() => resumed.snapshot()["context"])
      .toMatchObject({ answers: 1, answerTurn: joined ? "asking-turn" : "answer-turn" });
    expect(f.thread.messages).toHaveLength(1);
    expect(f.receipts.size).toBe(1);
    f.settle();
    await expect.poll(() => resumed.snapshot().status).toBe("done");
  },
);

test.each(["claudecode/toolUseId", "callId"])(
  "late %s tool activity identifies the caller through T3 detail",
  async (metaKey) => {
    const f = await fixture(true);
    const service = await recoveryService({ ...f.config, identifyTimeoutMs: 1200 });
    cleanup.push(() => service.stop());
    const calling = service.call(
      "handoff",
      { handoff: { outcome: "sorted" } },
      { [metaKey]: "late-call" },
    );
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    f.thread.activities.push(
      schemas.orchestrationReadModel.OrchestrationThreadActivity.parse({
        id: "tool-activity",
        tone: "tool",
        summary: "Tool started",
        kind: "tool.started",
        turnId: "asking-turn",
        createdAt: new Date().toISOString(),
        payload: { toolCallId: "late-call" },
      }),
    );
    expect(await calling).toMatchObject({
      status: "accepted",
      turnId: "asking-turn",
      replay: false,
    });
    await expect.poll(() => service.snapshot()["context"]).toMatchObject({ handoffs: 1 });
  },
);

test.each(["different", "unavailable"] as const)(
  "held follower with %s schema refuses every follower's handoff",
  async (held) => {
    const f = await fixture(true);
    const service = await recoveryService({ ...f.config, held });
    cleanup.push(() => service.stop());
    expect(service.host.followers("station", "conversation")).toEqual(["held-follower", "parcel"]);
    expect(
      await service.call("handoff", { thread: "conversation", handoff: { outcome: "sorted" } }),
    ).toMatchObject({
      status: "refused",
      code: held === "different" ? "invalid-handoff" : "task-held",
    });
    expect(service.store.pendingInbox("held-follower")).toHaveLength(0);
    expect(service.store.pendingInbox("parcel")).toHaveLength(0);
    expect(service.snapshot()["context"]).toMatchObject({ handoffs: 0 });
  },
);

test.each([
  ["available", false],
  ["available", true],
  ["unavailable", false],
  ["unavailable", true],
] as const)(
  "sole held follower with %s version identifies by metadata=%s",
  async (held, metadata) => {
    const f = await fixture(true);
    f.thread.activities.push(
      schemas.orchestrationReadModel.OrchestrationThreadActivity.parse({
        id: "tool-activity",
        tone: "tool",
        summary: "Tool started",
        kind: "tool.started",
        turnId: "asking-turn",
        createdAt: new Date().toISOString(),
        payload: { toolCallId: "held-call" },
      }),
    );
    const service = await recoveryService({ ...f.config, held, soleHeld: true });
    cleanup.push(() => service.stop());
    expect(service.host.followers("station", "conversation")).toEqual(["held-follower"]);
    const result = await service.call(
      "handoff",
      { handoff: { outcome: "sorted" }, ...(metadata ? {} : { thread: "conversation" }) },
      metadata ? { callId: "held-call" } : {},
    );
    expect(result).toMatchObject(
      held === "available"
        ? { status: "accepted", replay: false }
        : { status: "refused", code: "task-held" },
    );
    expect(service.store.pendingInbox("held-follower")).toHaveLength(held === "available" ? 1 : 0);
  },
);

test("a later turn hands off again while concurrent calls in one turn replay", async () => {
  const f = await fixture(true);
  const service = await recoveryService(f.config);
  cleanup.push(() => service.stop());
  const args = { thread: "conversation", handoff: { outcome: "sorted" } };
  const first = await Promise.all([service.call("handoff", args), service.call("handoff", args)]);
  expect(first.map((result) => result["replay"]).sort()).toEqual([false, true]);
  await expect.poll(() => service.snapshot()["context"]).toMatchObject({ handoffs: 1 });
  f.thread.session = {
    ...f.thread.session!,
    activeTurnId: schemas.common.TurnId.parse("next-turn"),
  };
  f.thread.latestTurn = {
    ...f.thread.latestTurn!,
    turnId: schemas.common.TurnId.parse("next-turn"),
  };
  f.server.change(f.thread);
  expect(await service.call("handoff", args)).toMatchObject({
    status: "accepted",
    replay: false,
    turnId: "next-turn",
  });
  await expect.poll(() => service.snapshot()["context"]).toMatchObject({ handoffs: 2 });
});
test("a caller with no running turn or matching call activity publishes nothing", async () => {
  const f = await fixture(true);
  const service = await recoveryService(f.config);
  cleanup.push(() => service.stop());
  f.thread.session = { ...f.thread.session!, status: "ready", activeTurnId: null };
  expect(await service.call("handoff", { thread: "conversation", handoff: {} })).toMatchObject({
    code: "caller-unidentified",
  });
  expect(await service.call("handoff", { handoff: {} }, { callId: "absent-call" })).toMatchObject({
    code: "caller-unidentified",
  });
  expect(service.snapshot()["context"]).toMatchObject({ handoffs: 0 });
});
test("an outside running thread's call id is refused without a source record", async () => {
  const f = await fixture(true);
  const outside = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...f.thread,
    id: "outside",
    activities: [
      {
        id: "outside-activity",
        tone: "tool",
        kind: "tool.started",
        turnId: "asking-turn",
        summary: "Tool started",
        payload: { toolCallId: "outside-call" },
        createdAt: f.thread.createdAt,
      },
    ],
  });
  f.server.baseline(outside);
  const service = await recoveryService(f.config);
  cleanup.push(() => service.stop());
  expect(await service.call("handoff", { handoff: {} }, { callId: "outside-call" })).toMatchObject({
    code: "not-followed",
  });
  expect(
    service.store.connection.database
      .prepare("SELECT COUNT(*) AS n FROM router_source_event WHERE source='agent'")
      .get()?.["n"],
  ).toBe(0);
});

test("blueprint message reaches the follower once and is read once across turns", async () => {
  const f = await fixture(true);
  const service = await recoveryService(f.config);
  cleanup.push(() => service.stop());
  await service.send(
    { environment: "station", threadId: "conversation" },
    "The depot schedule changed.",
  );
  await expect.poll(() => service.snapshot()["context"]).toMatchObject({ messages: 1 });
  const first = await service.call("get-messages", { thread: "conversation" });
  expect(first).toMatchObject({
    status: "read",
    messages: [
      { from: { actorId: "depot", issue: "shipment" }, text: "The depot schedule changed." },
    ],
  });
  expect(await service.call("get-messages", { thread: "conversation" })).toEqual(first);
  f.thread.session = {
    ...f.thread.session!,
    activeTurnId: schemas.common.TurnId.parse("later-turn"),
  };
  expect(await service.call("get-messages", { thread: "conversation" })).toMatchObject({
    status: "read",
    messages: [],
  });
  expect(f.receipts.size).toBe(0);
});

test("SIGKILL after a message commits resumes one delivery and one read", async () => {
  const f = await fixture(true);
  const senderTask = { repository: "sample/records", number: 7, title: "Repaint the garden shed" };
  const crash = worker({ ...f.config, senderTask, crash: "message" });
  await crash.ready();
  const exited = once(crash.child, "exit");
  crash.child.send({ kind: "send" });
  expect(await exited, crash.error()).toEqual([null, "SIGKILL"]);
  const resumed = await recoveryService({
    ...f.config,
    senderTask: { ...senderTask, title: "Changed title" },
  });
  cleanup.push(() => resumed.stop());
  await expect.poll(() => resumed.snapshot()["context"]).toMatchObject({ messages: 1 });
  await expect
    .poll(() => resumed.store.loadSnapshot("depot")?.snapshot)
    .toMatchObject({
      status: "done",
      value: "sent",
      context: { result: { messages: [{ threadId: "conversation" }] } },
    });
  expect(await resumed.call("get-messages", { thread: "conversation" })).toMatchObject({
    status: "read",
    messages: [{ from: { task: senderTask }, text: "The depot schedule changed." }],
  });
  expect(
    resumed.store.connection.database
      .prepare("SELECT COUNT(*) AS n FROM agenttool_message WHERE read_at IS NOT NULL")
      .get()!["n"],
  ).toBe(1);
});

test("two task actors deliver a message read through the compiled MCP plugin and service endpoint", async () => {
  const f = await fixture(true);
  const github = await githubFake();
  cleanup.push(github.close);
  github.issues.get("I_A")!.title = "Repaint the garden shed";
  github.addItem("IT_A", "I_A");
  github.addItem("IT_B", "I_B");
  github.addItem("IT_C", "I_C");
  const service = await recoveryService({
    ...f.config,
    githubUrl: github.url,
    senderIssue: "I_A",
    recipientIssue: "I_B",
  });
  cleanup.push(() => service.stop());
  await expect
    .poll(() => service.github!.trackedIssue("I_A")?.issue.title)
    .toBe("Repaint the garden shed");
  await service.send({ issue: "I_B" }, "The depot schedule changed.");
  await expect
    .poll(() => service.snapshot()["context"])
    .toMatchObject({
      messages: 1,
      lastSender: {
        actorId: "depot",
        issue: "I_A",
        task: { repository: "sample/records", number: 1, title: "Repaint the garden shed" },
      },
    });
  expect(service.snapshot()["context"]).toHaveProperty("lastSender", {
    actorId: "depot",
    issue: "I_A",
    task: { repository: "sample/records", number: 1, title: "Repaint the garden shed" },
  });
  const t3Home = join(f.config.path, "..", "t3-home");
  await mkdir(join(t3Home, "userdata"), { recursive: true });
  const t3db = new DatabaseSync(join(t3Home, "userdata/state.sqlite"));
  t3db.exec(
    "CREATE TABLE provider_session_runtime(thread_id TEXT,provider_name TEXT,provider_instance_id TEXT,resume_cursor_json TEXT)",
  );
  t3db
    .prepare("INSERT INTO provider_session_runtime VALUES (?, ?, ?, ?)")
    .run(
      "conversation",
      "codex",
      "example",
      JSON.stringify({ sessionId: "parcel-session", threadId: "parcel-session" }),
    );
  t3db.close();
  const hook = spawn(childArtifacts().host, [
    "hook",
    "post-tool-use",
    "--service",
    service.url,
    "--environment",
    "station",
    "--provider",
    "codex",
    "--t3-home",
    t3Home,
  ]);
  const hookExited = once(hook, "close");
  let hookOutput = "";
  hook.stdout.on("data", (data) => {
    hookOutput += String(data);
  });
  hook.stdin.end(JSON.stringify({ session_id: "parcel-session" }));
  expect(await hookExited).toEqual([0, null]);
  expect(hookOutput).toContain("1 new message");
  const endpoint = await service.call("get-messages", { thread: "conversation" });
  expect(endpoint).toMatchObject({
    messages: [
      {
        from: {
          actorId: "depot",
          issue: "I_A",
          task: { repository: "sample/records", number: 1, title: "Repaint the garden shed" },
        },
      },
    ],
  });
  expect(endpoint["message"]).toContain(
    "from task sample/records#1 (Repaint the garden shed), sent ",
  );
  const child = spawn(childArtifacts().host, [
    "mcp",
    "--service",
    service.url,
    "--environment",
    "station",
  ]);
  const exited = once(child, "exit");
  const replies: Record<string, unknown>[] = [];
  createInterface({ input: child.stdout }).on("line", (line) => replies.push(JSON.parse(line)));
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.stdin.end();
      await exited;
    }
  });
  child.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "parcel", version: "1" },
      },
    }) + "\n",
  );
  await expect.poll(() => replies.find((r) => r["id"] === 1)).toHaveProperty("result");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  child.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get-messages", arguments: { thread: "conversation" } },
    }) + "\n",
  );
  await expect
    .poll(() => replies.find((r) => r["id"] === 2))
    .toMatchObject({
      result: {
        isError: false,
        structuredContent: { status: "read", messages: [{ text: "The depot schedule changed." }] },
      },
    });
  expect(replies.find((r) => r["id"] === 2)).toMatchObject({
    result: { structuredContent: endpoint, content: [{ type: "text", text: endpoint["message"] }] },
  });
  await expect.poll(() => service.github!.trackedIssue("I_C")?.issue.nodeId).toBe("I_C");
  await service.send(
    { issue: "I_B" },
    "The parcel route changed.",
    "courier",
    "announce",
    "I_C",
    true,
  );
  await expect.poll(() => service.store.loadSnapshot("courier")?.snapshot.value).toBe("waiting");
  github.items.delete("IT_C");
  service.github!.requestSweep();
  await expect.poll(() => service.github!.trackedIssue("I_C")).toBeUndefined();
  await expect
    .poll(() => service.snapshot()["context"])
    .toMatchObject({ messages: 2, lastSender: { actorId: "courier", issue: "I_C", task: null } });
  const afterRemoval = await service.call("get-messages", { thread: "conversation" });
  expect(afterRemoval).toMatchObject({
    messages: [
      { from: { task: { repository: "sample/records", number: 1 } } },
      { from: { actorId: "courier", issue: "I_C", task: null } },
    ],
  });
  expect(afterRemoval["message"]).toContain("from task `courier`, sent ");
  child.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get-messages", arguments: { thread: "conversation" } },
    }) + "\n",
  );
  await expect
    .poll(() => replies.find((r) => r["id"] === 3))
    .toMatchObject({
      result: {
        isError: false,
        structuredContent: afterRemoval,
        content: [{ type: "text", text: afterRemoval["message"] }],
      },
    });
  child.stdin.end();
  expect(await exited).toEqual([0, null]);
  expect(f.receipts.size).toBe(0);
});

test("an issue address delivers mail without a transition for the event", async () => {
  const f = await fixture(true);
  const service = await recoveryService({ ...f.config, ignoreMessage: true });
  cleanup.push(() => service.stop());
  expect(service.host.issueThreads("shipment-recipient")).toEqual([
    { actorId: "parcel", environment: "station", threadId: "conversation" },
  ]);
  await service.send({ issue: "shipment-recipient" }, "The depot schedule changed.");
  await expect
    .poll(
      () =>
        service.store.connection.database
          .prepare("SELECT delivered_at FROM agenttool_message")
          .get()?.["delivered_at"],
    )
    .toBeTypeOf("number");
  expect(service.snapshot()["context"]).toMatchObject({ messages: 0 });
  expect(await service.call("get-messages", { thread: "conversation" })).toMatchObject({
    status: "read",
    messages: [{ text: "The depot schedule changed." }],
  });
});

test.each([
  [{ environment: "missing", threadId: "conversation" }, "text", false, "input"],
  [{ environment: "station", threadId: "absent" }, "text", false, "no-recipient"],
  [{ issue: "absent" }, "text", false, "no-recipient"],
  [{ environment: "station", threadId: "conversation" }, "", false, "input"],
  [{ environment: "station", threadId: "conversation" }, "text", true, "not-accepted"],
] as const)(
  "send refusal leaves no message or routed event: %j",
  async (to, text, noMessages, kind) => {
    const f = await fixture(true);
    const service = await recoveryService({ ...f.config, noMessages });
    cleanup.push(() => service.stop());
    await service.send(to, text);
    await expect
      .poll(() => service.store.loadSnapshot("depot")?.snapshot["context"])
      .toMatchObject({ error: { type: "send-message", kind } });
    expect(
      service.store.connection.database
        .prepare("SELECT COUNT(*) AS n FROM agenttool_message")
        .get()!["n"],
    ).toBe(0);
    expect(
      service.store.connection.database
        .prepare("SELECT COUNT(*) AS n FROM router_source_event WHERE source='agent'")
        .get()!["n"],
    ).toBe(0);
  },
);
test("SIGKILL after question commit preserves its task title on replay after a rename", async () => {
  const f = await fixture(true);
  const crash = worker({ ...f.config, issueTitle: "Repaint the garden shed", crash: "escalate" });
  await crash.ready();
  const exited = once(crash.child, "exit");
  crash.child.send({
    kind: "call",
    tool: "escalate",
    args: {
      thread: "conversation",
      question: "Which colour?",
      title: "Paint colour",
      freeText: true,
    },
  });
  expect(await exited, crash.error()).toEqual([null, "SIGKILL"]);
  const resumed = await recoveryService({ ...f.config, issueTitle: "Renamed issue" });
  cleanup.push(() => resumed.stop());
  const result = await resumed.call("escalate", {
    thread: "conversation",
    question: "Again?",
    title: "Changed title",
    freeText: true,
  });
  expect(result).toMatchObject({ status: "raised", replay: true });
  const questions = resumed.escalations.list({});
  expect(questions).toHaveLength(1);
  expect(questions[0]!.title).toBe("example-org/widgets#7: Paint colour — Repaint the garden shed");
  expect(questions[0]!.id).toBe(result["escalationId"]);
});

test.each([
  [
    { repository: "example-org/widgets", number: 7, title: "Repaint the garden shed" },
    "shipment",
    "example-org/widgets#7 (Repaint the garden shed)",
  ],
  [{ repository: "example-org/widgets", number: 7 }, "shipment", "example-org/widgets#7"],
  [undefined, "shipment", "`depot`"],
  [undefined, null, "`depot`"],
] as const)(
  "message stores its sender and keeps it on repeated reads: %j",
  async (senderTask, senderIssue, label) => {
    const f = await fixture(true);
    const config: RecoveryConfiguration = {
      ...f.config,
      ...(senderTask ? { senderTask } : {}),
      senderIssue,
    };
    const service = await recoveryService(config);
    cleanup.push(() => service.stop());
    await service.send({ issue: "shipment-recipient" }, "The depot schedule changed.");
    await expect.poll(() => service.snapshot()["context"]).toMatchObject({ messages: 1 });
    const first = await service.call("get-messages", { thread: "conversation" });
    expect(first).toMatchObject({
      status: "read",
      messages: [{ from: { actorId: "depot", issue: senderIssue, task: senderTask ?? null } }],
    });
    expect(first["message"]).toContain(`from task ${label}, sent `);
    expect(service.issueReads).toEqual(senderIssue === null ? [] : [senderIssue]);
    config.senderTask = { repository: "example-org/widgets", number: 7, title: "Changed title" };
    expect(await service.call("get-messages", { thread: "conversation" })).toEqual(first);
  },
);

test("SIGKILL after a read preserves the stored sender despite a mirror rename", async () => {
  const f = await fixture(true);
  const senderTask = {
    repository: "example-org/widgets",
    number: 7,
    title: "Repaint the garden shed",
  };
  const crash = worker({ ...f.config, senderTask });
  await crash.ready();
  crash.child.send({ kind: "send" });
  await expect
    .poll(() => {
      crash.child.send({ kind: "snapshot" });
      return crash.messages.findLast((m) => m["kind"] === "snapshot")?.["snapshot"];
    })
    .toMatchObject({ context: { messages: 1 } });
  crash.child.send({ kind: "call", tool: "get-messages", args: { thread: "conversation" } });
  await expect
    .poll(() => crash.messages.find((m) => m["kind"] === "call"))
    .toHaveProperty("result");
  const first = crash.messages.find((m) => m["kind"] === "call")!["result"];
  expect(first).toMatchObject({ messages: [{ from: { task: senderTask } }] });
  const exited = once(crash.child, "exit");
  crash.child.kill("SIGKILL");
  expect(await exited, crash.error()).toEqual([null, "SIGKILL"]);
  const resumed = await recoveryService({
    ...f.config,
    senderTask: { ...senderTask, title: "Changed title" },
  });
  cleanup.push(() => resumed.stop());
  const read = await resumed.call("get-messages", { thread: "conversation" });
  expect(read).toEqual(first);
  expect(read).toMatchObject({
    status: "read",
    messages: [{ from: { actorId: "depot", issue: "shipment", task: senderTask } }],
  });
  expect(read["message"]).toContain(
    "from task example-org/widgets#7 (Repaint the garden shed), sent ",
  );
  expect(await resumed.call("get-messages", { thread: "conversation" })).toEqual(read);
});

test("a populated message without a sender name reopens and reads with its actor label", async () => {
  const f = await fixture(true);
  const service = await recoveryService({ ...f.config, seedMessage: true });
  const before = await service.call("get-messages", { thread: "conversation" });
  expect(before).toMatchObject({
    status: "read",
    messages: [
      {
        from: { actorId: "depot", issue: "shipment", task: null },
        text: "The depot schedule changed.",
      },
    ],
  });
  expect(before["message"]).toContain("from task `depot`, sent ");
  expect(
    service.store.connection.database
      .prepare("SELECT version FROM schema_migration WHERE owner='agenttool'")
      .get()!["version"],
  ).toBe(1);
  await service.stop();
  const resumed = await recoveryService(f.config);
  cleanup.push(() => resumed.stop());
  expect(await resumed.call("get-messages", { thread: "conversation" })).toEqual(before);
});

test("one send reads the mirror once and stores the same sender for two threads", async () => {
  const f = await fixture(true);
  f.server.baseline(
    schemas.orchestrationReadModel.OrchestrationThread.parse({
      ...f.thread,
      id: "other-conversation",
      session: { ...f.thread.session, threadId: "other-conversation" },
    }),
  );
  const senderTask = { repository: "sample/records", number: 7, title: "Repaint the garden shed" };
  const service = await recoveryService({
    ...f.config,
    senderTask,
    recipientThreads: ["conversation", "other-conversation"],
  });
  cleanup.push(() => service.stop());
  await service.send({ issue: "shipment-recipient" }, "The depot schedule changed.");
  await expect.poll(() => service.snapshot()["context"]).toMatchObject({ messages: 2 });
  expect(service.issueReads).toEqual(["shipment"]);
  for (const thread of ["conversation", "other-conversation"])
    expect(await service.call("get-messages", { thread })).toMatchObject({
      status: "read",
      messages: [{ from: { actorId: "depot", issue: "shipment", task: senderTask } }],
    });
  expect(service.issueReads).toEqual(["shipment"]);
});

test("a mirror issue with an empty title sends only its repository and number", async () => {
  const f = await fixture(true);
  const service = await recoveryService({
    ...f.config,
    senderTask: { repository: "sample/records", number: 7, title: "" },
  });
  cleanup.push(() => service.stop());
  await service.send({ issue: "shipment-recipient" }, "The depot schedule changed.");
  await expect.poll(() => service.snapshot()["context"]).toMatchObject({ messages: 1 });
  expect(service.snapshot()["context"]).toHaveProperty("lastSender", {
    actorId: "depot",
    issue: "shipment",
    task: { repository: "sample/records", number: 7 },
  });
  const read = await service.call("get-messages", { thread: "conversation" });
  expect(read).toHaveProperty("messages.0.from.task", { repository: "sample/records", number: 7 });
  expect(read["message"]).toContain("from task sample/records#7, sent ");
});
