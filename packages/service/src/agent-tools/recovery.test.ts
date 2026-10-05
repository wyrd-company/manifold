// ---
// relationships:
//   verifies: [agent-tools, durable-event-delivery, agent-threads]
// ---
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fork } from "node:child_process";
import { once } from "node:events";
import { afterEach, expect, test } from "vite-plus/test";
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
