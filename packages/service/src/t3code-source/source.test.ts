// ---
// relationships:
//   verifies: t3code-environment-source
// ---
import { schemas } from "@wyrd-company/t3code-client";
import { DatabaseSync } from "node:sqlite";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { readFile } from "node:fs/promises";
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, test } from "vite-plus/test";
import { startT3CodeSource, threadTopic } from "./index.ts";
import type { T3CodeSourceOptions } from "./index.ts";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import { fakeServer, fixtureThread } from "./test-fixtures/server.ts";
const eventSchema = parse(
  await readFile(
    new URL("../../../../docs/specifications/t3code-thread-events.schema.yml", import.meta.url),
    "utf8",
  ),
) as object;
const validateEvent = new Ajv2020({ strict: false, formats: { "date-time": true } })
  .addSchema(eventSchema)
  .compile({
    $ref: "https://manifold.wyrd.company/schemas/t3code-thread-events#/$defs/thread-change-event",
  });
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "thread-source-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const server = await fakeServer();
  cleanup.push(() => server.close());
  const token = join(directory, "token");
  await writeFile(token, "fixture-token");
  const store = openStore({ path: join(directory, "store.sqlite") });
  cleanup.push(async () => store.close());
  store.saveSnapshot({
    actorId: "reader",
    machine: "recipe",
    snapshot: { status: "active", value: "waiting" },
  });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: ["t3"] }),
      restore: () => ({ status: "held", reason: "fixture" }),
    },
  });
  cleanup.push(async () => router.stop());
  const options = {
    store,
    router: {
      ...router,
      publish(event) {
        expect(event.source).toBe("t3");
        expect(event.topics).toEqual([
          threadTopic(String(event.event["environment"]), String(event.event["threadId"])),
        ]);
        expect(validateEvent(event.event), JSON.stringify(validateEvent.errors)).toBe(true);
        return router.publish(event);
      },
    },
    tokenFile: () => token,
    environments: {
      station: {
        url: server.url,
        credential: "reader",
        reconnect: { initialMs: 10, factor: 2, maxMs: 30, jitter: 0 },
        heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
        openTimeoutMs: 10000,
      },
    },
  } satisfies T3CodeSourceOptions;
  const start = () => {
    const source = startT3CodeSource(options);
    cleanup.push(() => source.stop());
    return source;
  };
  return { server, store, options, start, token, directory };
}
test("encodes thread identities without topic segment collisions", () => {
  expect(threadTopic("station", "a.b/% snow ☃")).toBe(
    "t3.environment.station.thread.a%2Eb%2F%25%20snow%20%E2%98%83",
  );
  expect(() => threadTopic("station", "\ud800")).toThrow();
});
test("baselines existing state and publishes a post-origin thread once across restart", async () => {
  const { server, store, start } = await setup();
  const old = fixtureThread("old");
  old.latestTurn = {
    turnId: "old-turn" as NonNullable<typeof old.latestTurn>["turnId"],
    state: "completed",
    requestedAt: old.createdAt,
    startedAt: old.createdAt,
    completedAt: old.createdAt,
    assistantMessageId: null,
  };
  old.session = {
    threadId: old.id,
    status: "error",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: "Old failure",
    updatedAt: old.createdAt,
  };
  server.baseline(old);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  expect(store.pendingInbox("reader")).toHaveLength(0);
  const thread = fixtureThread();
  thread.latestTurn = {
    turnId: "turn-one" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "completed",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: thread.createdAt,
    assistantMessageId: null,
  };
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(store.pendingInbox("reader").map((r) => r.payload)).toEqual([
    {
      type: "t3.turn.started",
      environment: "station",
      threadId: thread.id,
      projectId: "project",
      turnId: "turn-one",
      messageId: null,
    },
    {
      type: "t3.turn.settled",
      environment: "station",
      threadId: thread.id,
      projectId: "project",
      turnId: "turn-one",
      messageId: null,
      state: "completed",
      assistantMessageId: null,
      error: null,
    },
  ]);
  await source.stop();
  const resumed = start();
  await expect.poll(() => resumed.status()[0]?.state).toBe("following");
  await expect.poll(() => resumed.status()[0]?.openSubscriptions).toBe(0);
  expect(store.pendingInbox("reader")).toHaveLength(2);
});
test.each([1000, 0])("resumes request and turn changes through replay bound %s", async (bound) => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  await source.stop();
  server.setBound(bound);
  const opened = {
    id: "activity-open",
    kind: "approval.requested",
    tone: "approval",
    summary: "Confirm recipe",
    turnId: null,
    createdAt: thread.createdAt,
    payload: { requestId: "request-one", detail: "Use the oven" },
  };
  thread.activities = [opened as (typeof thread.activities)[number]];
  server.change(thread, "thread.activity-appended", { threadId: thread.id, activity: opened });
  const resolved = {
    ...opened,
    id: "activity-resolved",
    kind: "approval.resolved",
    payload: { requestId: "request-one", decision: "approved" },
  };
  if (bound) {
    thread.activities.push(resolved as (typeof thread.activities)[number]);
    server.change(thread, "thread.activity-appended", { threadId: thread.id, activity: resolved });
  }
  const resumed = start();
  await expect.poll(() => store.pendingInbox("reader").length).toBe(bound ? 2 : 1);
  expect(store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type)).toEqual(
    bound ? ["t3.request.opened", "t3.request.resolved"] : ["t3.request.opened"],
  );
  await resumed.stop();
  const again = start();
  await expect.poll(() => again.status()[0]?.state).toBe("following");
  expect(store.pendingInbox("reader")).toHaveLength(bound ? 2 : 1);
});
test("closes idle subscriptions and reopens them for live state changes", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  server.baseline(thread);
  const source = start();
  await expect
    .poll(
      () =>
        source.status()[0]?.openSubscriptions === 0 && source.status()[0]?.state === "following",
    )
    .toBe(true);
  thread.session = {
    threadId: thread.id,
    status: "running",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: "turn-two" as NonNullable<typeof thread.latestTurn>["turnId"],
    lastError: null,
    updatedAt: thread.createdAt,
  };
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  expect(source.status()[0]?.openSubscriptions).toBe(1);
  thread.session = {
    ...thread.session,
    status: "error",
    activeTurnId: null,
    lastError: "Fixture error",
    updatedAt: "2026-01-01T00:00:01.000Z",
  };
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(3);
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  expect(store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type)).toEqual([
    "t3.turn.started",
    "t3.turn.settled",
    "t3.session.failed",
  ]);
});
test("archives, unarchives, and deletes a thread through shell state", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  thread.archivedAt = thread.createdAt;
  server.change(thread, "thread.archived", {
    threadId: thread.id,
    archivedAt: thread.archivedAt,
    updatedAt: thread.updatedAt,
  });
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  expect(source.status()[0]?.followedThreads).toBe(0);
  thread.archivedAt = null;
  server.change(thread, "thread.unarchived", { threadId: thread.id, updatedAt: thread.updatedAt });
  await expect.poll(() => source.status()[0]?.followedThreads).toBe(1);
  thread.deletedAt = thread.createdAt;
  server.change(thread, "thread.deleted", { threadId: thread.id, deletedAt: thread.deletedAt });
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type)).toEqual([
    "t3.thread.archived",
    "t3.thread.deleted",
  ]);
});
test("archives a running thread after catching up rather than waiting for idle", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  thread.session = {
    threadId: thread.id,
    status: "running",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: null,
    updatedAt: thread.createdAt,
  };
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  thread.archivedAt = thread.createdAt;
  server.change(thread, "thread.archived", {
    threadId: thread.id,
    archivedAt: thread.archivedAt,
    updatedAt: thread.updatedAt,
  });
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
});
test("does not suppress changes between the atomic baseline and first thread subscription", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  server.baseline(thread);
  server.hooks.readModel = () => {
    delete server.hooks.readModel;
    thread.session = {
      threadId: thread.id,
      status: "running",
      providerName: "provider",
      runtimeMode: "full-access",
      activeTurnId: "turn-race" as NonNullable<typeof thread.latestTurn>["turnId"],
      lastError: null,
      updatedAt: thread.createdAt,
    };
    server.change(thread);
  };
  start();
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  expect((store.pendingInbox("reader")[0]!.payload as { turnId: string }).turnId).toBe("turn-race");
});
test("a shell advance during synchronization cannot skip a queued thread event", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  server.baseline(thread);
  const source = start();
  await expect
    .poll(
      () =>
        source.status()[0]?.state === "following" && source.status()[0]?.openSubscriptions === 0,
    )
    .toBe(true);
  server.hooks.threadSubscribe = () => {
    delete server.hooks.threadSubscribe;
    thread.session = {
      threadId: thread.id,
      status: "running",
      providerName: "provider",
      runtimeMode: "full-access",
      activeTurnId: "turn-race" as NonNullable<typeof thread.latestTurn>["turnId"],
      lastError: null,
      updatedAt: thread.createdAt,
    };
    server.change(thread);
  };
  server.change(thread, "thread.meta-updated", {
    threadId: thread.id,
    title: "A revised recipe",
    updatedAt: thread.updatedAt,
  });
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
});
test("a replaced server can reuse identities without replay suppression", async () => {
  const { server, store, start } = await setup();
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  const thread = fixtureThread();
  thread.session = {
    threadId: thread.id,
    status: "running",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: "reused-turn" as NonNullable<typeof thread.latestTurn>["turnId"],
    lastError: null,
    updatedAt: thread.createdAt,
  };
  thread.latestTurn = {
    turnId: thread.session.activeTurnId!,
    state: "running",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: null,
    assistantMessageId: null,
  };
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  await source.stop();
  server.reset("server-two");
  const resumed = start();
  await expect.poll(() => resumed.status()[0]?.state).toBe("following");
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(store.pendingInbox("reader").map((r) => r.eventId)).toEqual([
    "t3:station/server-one/conversation/turn/reused-turn/started",
    "t3:station/server-two/conversation/turn/reused-turn/started",
  ]);
});
test("a dropped connection replays an approval opened and resolved before reconnect", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  server.drop();
  const opened = {
    id: "open",
    kind: "approval.requested",
    tone: "approval",
    summary: "Recipe approval",
    turnId: null,
    createdAt: thread.createdAt,
    payload: { requestId: "approval" },
  };
  const resolved = {
    ...opened,
    id: "resolved",
    kind: "approval.resolved",
    payload: { requestId: "approval", decision: "approved" },
  };
  thread.activities = [opened as (typeof thread.activities)[number]];
  server.change(thread, "thread.activity-appended", { threadId: thread.id, activity: opened });
  thread.activities.push(resolved as (typeof thread.activities)[number]);
  server.change(thread, "thread.activity-appended", { threadId: thread.id, activity: resolved });
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type)).toEqual([
    "t3.request.opened",
    "t3.request.resolved",
  ]);
});
test("a rejected credential retries with a replaced operator token", async () => {
  const { server, store, start, token } = await setup();
  server.setToken("replacement-token");
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("retrying");
  await writeFile(token, "replacement-token");
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  const thread = fixtureThread();
  thread.session = {
    threadId: thread.id,
    status: "error",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: "Fixture",
    updatedAt: thread.createdAt,
  };
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
});
test("SIGKILL inside publishing rolls back the inbox and cursor, and restart replays the server log", async () => {
  const { server, store, options, token, directory } = await setup();
  const thread = fixtureThread();
  server.baseline(thread);
  function worker(pause: boolean) {
    const child = fork(
      new URL("./test-fixtures/crash-worker.ts", import.meta.url),
      [
        JSON.stringify({
          path: join(directory, "store.sqlite"),
          token,
          environments: options.environments,
          pause,
        }),
      ],
      { silent: true },
    );
    let stderr = "";
    child.stderr!.on("data", (value) => {
      stderr += String(value);
    });
    const messages = new Set<unknown>();
    // Await IPC readiness; Node startup must not race expect.poll's 1 s limit.
    const following = new Promise<void>((resolve, reject) => {
      child.on("message", (message) => {
        messages.add(message);
        if (message === "following") resolve();
      });
      child.once("error", reject);
      child.once("exit", (code, signal) => {
        reject(new Error(`Worker exited before readiness (${code}, ${signal}): ${stderr}`));
      });
    });
    cleanup.push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit");
        child.kill("SIGKILL");
        await exit;
      }
    });
    return { child, messages, following };
  }
  const first = worker(true);
  await first.following;
  const opened = {
    id: "activity-open",
    kind: "approval.requested",
    tone: "approval",
    summary: "Recipe approval",
    turnId: null,
    createdAt: thread.createdAt,
    payload: { requestId: "request-one" },
  };
  thread.activities = [opened as (typeof thread.activities)[number]];
  server.change(thread, "thread.activity-appended", { threadId: thread.id, activity: opened });
  await expect.poll(() => first.messages.has("inside-transaction")).toBe(true);
  const exited = once(first.child, "exit");
  first.child.kill("SIGKILL");
  expect(await exited).toEqual([null, "SIGKILL"]);
  expect(store.pendingInbox("reader")).toHaveLength(0);
  const resolved = {
    ...opened,
    id: "activity-resolved",
    kind: "approval.resolved",
    payload: { requestId: "request-one", decision: "approved" },
  };
  thread.activities.push(resolved as (typeof thread.activities)[number]);
  server.change(thread, "thread.activity-appended", { threadId: thread.id, activity: resolved });
  const resumed = worker(false);
  await resumed.following;
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(server.log).toHaveLength(2);
  expect(store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type)).toEqual([
    "t3.request.opened",
    "t3.request.resolved",
  ]);
  const stopped = once(resumed.child, "exit");
  resumed.child.send("stop");
  await stopped;
  const again = worker(false);
  await again.following;
  expect(store.pendingInbox("reader")).toHaveLength(2);
  const stoppedAgain = once(again.child, "exit");
  again.child.send("stop");
  await stoppedAgain;
});
test("a rejected environment credential does not delay another environment", async () => {
  const { server, store, options } = await setup();
  const unavailable = await fakeServer();
  cleanup.push(() => unavailable.close());
  unavailable.setToken("unavailable-token");
  const source = startT3CodeSource({
    ...options,
    environments: {
      ...options.environments,
      other: { ...options.environments.station, url: unavailable.url },
    },
  });
  cleanup.push(() => source.stop());
  await expect.poll(() => source.status().map((s) => s.state)).toEqual(["following", "retrying"]);
  const thread = fixtureThread();
  thread.latestTurn = {
    turnId: "turn-one" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "completed",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: thread.createdAt,
    assistantMessageId: null,
  };
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(source.status()[1]?.followedThreads).toBe(0);
});
test("router rejection rolls back a projection and stops only its environment", async () => {
  const { server, store, options } = await setup();
  const source = startT3CodeSource({
    ...options,
    router: {
      ...options.router,
      publish(event) {
        return event.event["environment"] === "station"
          ? { status: "rejected", issues: [] }
          : options.router.publish(event);
      },
    },
    environments: { ...options.environments, other: options.environments.station },
  });
  cleanup.push(() => source.stop());
  await expect.poll(() => source.status().map((s) => s.state)).toEqual(["following", "following"]);
  const thread = fixtureThread();
  thread.latestTurn = {
    turnId: "turn-one" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "completed",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: thread.createdAt,
    assistantMessageId: null,
  };
  server.change(thread);
  await expect.poll(() => source.status().map((s) => s.state)).toEqual(["stopped", "following"]);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(
    store
      .pendingInbox("reader")
      .every((row) => (row.payload as { environment: string }).environment === "other"),
  ).toBe(true);
});
test("snapshot comparison orders turns, resolved requests, opened requests, and session failures", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  const request = (id: string, kind: string) =>
    ({
      id: `activity-${id}`,
      kind,
      tone: "approval",
      summary: "Recipe request",
      turnId: null,
      createdAt: thread.createdAt,
      payload: { requestId: id, ...(kind === "user-input.requested" ? { questions: [] } : {}) },
    }) as (typeof thread.activities)[number];
  thread.activities = [request("old-request", "approval.requested")];
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  await source.stop();
  server.setBound(0);
  thread.activities = [request("new-request", "user-input.requested")];
  thread.latestTurn = {
    turnId: "finished-turn" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "error",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: thread.createdAt,
    assistantMessageId: null,
  };
  thread.session = {
    threadId: thread.id,
    status: "error",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: "Fixture",
    updatedAt: thread.createdAt,
  };
  server.change(thread);
  start();
  await expect.poll(() => store.pendingInbox("reader").length).toBe(5);
  expect(store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type)).toEqual([
    "t3.turn.started",
    "t3.turn.settled",
    "t3.request.resolved",
    "t3.request.opened",
    "t3.session.failed",
  ]);
  expect(
    store.pendingInbox("reader")[3]!.payload as { kind: string; detail: unknown },
  ).toMatchObject({ kind: "user-input", detail: { requestId: "new-request", questions: [] } });
});
test("compact projections retain the checkpoints a revert needs", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  const checkpoint = {
    turnId: "older-turn",
    checkpointTurnCount: 1,
    checkpointRef: "checkpoint",
    status: "ready",
    files: [{ path: "recipe.txt", kind: "modified", additions: 1, deletions: 0 }],
    assistantMessageId: "answer",
    completedAt: thread.createdAt,
  };
  thread.checkpoints = [checkpoint as (typeof thread.checkpoints)[number]];
  thread.latestTurn = {
    turnId: "newer-turn" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "completed",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: thread.createdAt,
    assistantMessageId: null,
  };
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  server.change(thread, "thread.reverted", { threadId: thread.id, turnCount: 1 });
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(store.pendingInbox("reader").map((r) => r.payload)).toEqual([
    {
      type: "t3.turn.started",
      environment: "station",
      threadId: thread.id,
      projectId: "project",
      turnId: "older-turn",
      messageId: null,
    },
    {
      type: "t3.turn.settled",
      environment: "station",
      threadId: thread.id,
      projectId: "project",
      turnId: "older-turn",
      messageId: null,
      state: "completed",
      assistantMessageId: "answer",
      error: null,
    },
  ]);
});
test("an environment whose server is down leaves another environment following", async () => {
  const { server, store, options } = await setup();
  const offline = await fakeServer();
  await offline.close();
  const source = startT3CodeSource({
    ...options,
    environments: {
      ...options.environments,
      other: { ...options.environments.station, url: offline.url },
    },
  });
  cleanup.push(() => source.stop());
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  const thread = fixtureThread();
  thread.latestTurn = {
    turnId: "turn-one" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "completed",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: thread.createdAt,
    assistantMessageId: null,
  };
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(source.status()[1]?.state).toBe("connecting");
});
test("the public source migrates tables that agree with the specification", async () => {
  const { store, options } = await setup();
  const source = startT3CodeSource({ ...options, environments: {} });
  await source.stop();
  const reference = new DatabaseSync(":memory:");
  try {
    reference.exec(
      await readFile(
        new URL(
          "../../../../docs/specifications/t3code-source-database-schema.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const query = "SELECT name, type, sql FROM sqlite_schema WHERE name LIKE 't3_%' ORDER BY name";
    expect(store.connection.database.prepare(query).all()).toEqual(reference.prepare(query).all());
    expect(
      store.connection.database
        .prepare("SELECT version FROM schema_migration WHERE owner = 'tthree'")
        .get(),
    ).toEqual({ version: 3 });
  } finally {
    reference.close();
  }
});

test.each(["detail", "shell", "restart"])(
  "publishes deletion before the first snapshot via %s",
  async (mode) => {
    const { server, store, start } = await setup();
    const source = start();
    await expect.poll(() => source.status()[0]?.state).toBe("following");
    await expect
      .poll(() => server.requests.some((r) => r.tag === "orchestration.subscribeShell"))
      .toBe(true);
    const thread = fixtureThread("fleeting");
    server.hooks.beforeThreadSnapshot = () => {
      if (mode === "restart") return false;
      thread.deletedAt = thread.createdAt;
      if (mode === "shell")
        server.change(thread, "thread.deleted", {
          threadId: thread.id,
          deletedAt: thread.deletedAt,
        });
      else server.baseline(thread);
    };
    server.change(thread);
    await expect
      .poll(() => server.requests.some((r) => r.payload["threadId"] === thread.id))
      .toBe(true);
    let current = source;
    if (mode === "restart") {
      await source.stop();
      thread.deletedAt = thread.createdAt;
      server.change(thread, "thread.deleted", { threadId: thread.id, deletedAt: thread.deletedAt });
      delete server.hooks.beforeThreadSnapshot;
      current = start();
    }
    await expect
      .poll(() => store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type))
      .toEqual(["t3.thread.deleted"]);
    expect(store.pendingInbox("reader")[0]?.payload).toMatchObject({
      projectId: "project",
      threadId: "fleeting",
    });
    expect(server.requests.filter((r) => r.tag === "orchestration.subscribeShell")).toHaveLength(
      mode === "restart" ? 2 : 1,
    );
    await expect.poll(() => current.status()[0]?.state).toBe("following");
    await expect.poll(() => current.status()[0]?.openSubscriptions).toBe(0);
    delete server.hooks.beforeThreadSnapshot;
    const survivor = fixtureThread("survivor");
    survivor.latestTurn = {
      turnId: "turn" as NonNullable<typeof survivor.latestTurn>["turnId"],
      state: "completed",
      requestedAt: survivor.createdAt,
      startedAt: survivor.createdAt,
      completedAt: survivor.createdAt,
      assistantMessageId: null,
    };
    server.change(survivor);
    await expect.poll(() => store.pendingInbox("reader").length).toBe(3);
    await current.stop();
    const resumed = start();
    await expect.poll(() => resumed.status()[0]?.state).toBe("following");
    await expect.poll(() => resumed.status()[0]?.openSubscriptions).toBe(0);
    expect(store.pendingInbox("reader")).toHaveLength(3);
  },
);
test("publishes archive before the first snapshot", async () => {
  const { server, store, start } = await setup();
  const source = start();
  await expect
    .poll(() => server.requests.some((r) => r.tag === "orchestration.subscribeShell"))
    .toBe(true);
  const thread = fixtureThread("fleeting");
  server.hooks.beforeThreadSnapshot = () => {
    delete server.hooks.beforeThreadSnapshot;
    thread.archivedAt = thread.createdAt;
    server.change(thread, "thread.archived", {
      threadId: thread.id,
      archivedAt: thread.archivedAt,
      updatedAt: thread.updatedAt,
    });
  };
  server.change(thread);
  await expect
    .poll(() => store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type))
    .toEqual(["t3.thread.archived"]);
  expect(store.pendingInbox("reader")[0]?.payload).toMatchObject({
    projectId: "project",
    threadId: "fleeting",
    archivedAt: thread.createdAt,
  });
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
});
test("unknown turn states and session statuses count as none", async () => {
  const { server, store, start } = await setup();
  const source = start();
  await expect
    .poll(() => server.requests.some((r) => r.tag === "orchestration.subscribeShell"))
    .toBe(true);
  const base = fixtureThread();
  const thread = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...base,
    latestTurn: {
      turnId: "future-turn",
      state: "future-state",
      requestedAt: base.createdAt,
      startedAt: base.createdAt,
      completedAt: null,
      assistantMessageId: null,
    },
    session: {
      threadId: base.id,
      status: "future-status",
      providerName: "provider",
      runtimeMode: "full-access",
      activeTurnId: null,
      lastError: null,
      updatedAt: base.createdAt,
    },
  });
  server.change(thread);
  await expect
    .poll(() => server.requests.some((r) => r.payload["threadId"] === thread.id))
    .toBe(true);
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  expect(source.status()[0]?.state).toBe("following");
  expect(store.pendingInbox("reader")).toHaveLength(0);
  server.setBound(0);
  thread.latestTurn = { ...thread.latestTurn!, state: "completed" };
  thread.session = { ...thread.session!, status: "error", lastError: "Failure" };
  server.change(thread);
  await expect
    .poll(() => store.pendingInbox("reader").map((r) => (r.payload as { type: string }).type))
    .toEqual(["t3.turn.started", "t3.turn.settled", "t3.session.failed"]);
});

test("upgrades populated source tables and preserves project identity", async () => {
  const { server, store, start } = await setup();
  const ddl = await readFile(
    new URL("../../../../docs/specifications/t3code-source-database-schema.sql", import.meta.url),
    "utf8",
  );
  store.connection.migrate("tthree", [ddl.split("ALTER TABLE")[0]!]);
  const thread = fixtureThread("existing");
  store.connection.database
    .prepare("INSERT INTO t3_environment VALUES (?, ?, ?, ?)")
    .run("station", "server-one", 0, 0);
  store.connection.database
    .prepare("INSERT INTO t3_thread VALUES (?, ?, ?, ?, ?)")
    .run("station", thread.id, "followed", 0, JSON.stringify(thread));
  thread.deletedAt = thread.createdAt;
  server.baseline(thread);
  const source = start();
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  expect(store.pendingInbox("reader")[0]?.payload).toMatchObject({
    type: "t3.thread.deleted",
    projectId: "project",
    threadId: "existing",
  });
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  expect(source.status()[0]?.state).toBe("following");
});

function userMessage(id: string, createdAt: string) {
  return {
    id,
    role: "user" as const,
    text: "Prepare a recipe",
    turnId: null,
    streaming: false,
    createdAt,
    updatedAt: createdAt,
  };
}
function running(thread: ReturnType<typeof fixtureThread>, turn: string, at: string) {
  thread.session = {
    threadId: thread.id,
    status: "running",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: turn as NonNullable<typeof thread.latestTurn>["turnId"],
    lastError: null,
    updatedAt: at,
  };
  thread.latestTurn = {
    turnId: thread.session.activeTurnId!,
    state: "running",
    requestedAt: at,
    startedAt: at,
    completedAt: null,
    assistantMessageId: null,
  };
}
test("ready waits for the origin, survives lost connections, and rejects abort and unknown names", async () => {
  const { server, start } = await setup();
  let release!: () => void;
  server.hooks.beforeReadModel = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const source = start();
  let ready = false;
  const waiting = source.ready("station").then(() => {
    ready = true;
  });
  await expect.poll(() => typeof release).toBe("function");
  expect(ready).toBe(false);
  const abort = new AbortController();
  const aborted = expect(source.ready("station", abort.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  abort.abort();
  await aborted;
  await expect(source.ready("missing")).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "environment",
  });
  release();
  await waiting;
  await source.ready("station");
  server.drop();
  await source.ready("station");
  await source.stop();
  await expect(source.ready("station")).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "environment",
  });
});
test("stopping the source fails an admitted write and aborts its transport signal", async () => {
  const { start } = await setup();
  const source = start();
  await source.ready("station");
  let transport: AbortSignal | undefined;
  const pending = source.write(
    "station",
    "conversation",
    new AbortController().signal,
    (signal) => {
      transport = signal;
      return new Promise<void>(() => {});
    },
  );
  const failed = expect(pending).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "environment",
  });
  await expect.poll(() => transport !== undefined).toBe(true);
  await source.stop();
  await failed;
  expect(transport!.aborted).toBe(true);
});
test("ready rejects when the source stops before its first connection", async () => {
  const { server, options } = await setup();
  server.setToken("unavailable-token");
  const source = startT3CodeSource(options);
  cleanup.push(() => source.stop());
  const waiting = expect(source.ready("station")).rejects.toMatchObject({
    name: "AgentThreadError",
    kind: "environment",
  });
  await expect.poll(() => source.status()[0]?.state).toBe("retrying");
  await source.stop();
  await waiting;
});
test.each(["live", "replay", "snapshot"])(
  "attributes turns to requesting messages through %s",
  async (mode) => {
    const { server, store, start } = await setup();
    const thread = fixtureThread();
    server.baseline(thread);
    const source = start();
    await expect.poll(() => source.status()[0]?.state).toBe("following");
    await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
    if (mode !== "live") await source.stop();
    if (mode === "snapshot") server.setBound(0);
    const message = userMessage("requesting-message", "2026-01-01T00:00:01.000Z");
    thread.messages.push(message as (typeof thread.messages)[number]);
    server.change(thread, "thread.message-sent", {
      threadId: thread.id,
      ...message,
      messageId: message.id,
    });
    running(thread, "requested-turn", message.createdAt);
    server.change(thread);
    if (mode !== "live") start();
    await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
    expect(store.pendingInbox("reader")[0]!.payload).toMatchObject({
      turnId: "requested-turn",
      messageId: message.id,
    });
  },
);
test("preserves a message queued during a turn across restart and attribution across snapshots", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  const first = userMessage("first-message", thread.createdAt);
  thread.messages.push(first as (typeof thread.messages)[number]);
  running(thread, "first-turn", first.createdAt);
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  const next = userMessage("next-message", "2026-01-01T00:00:01.000Z");
  thread.messages.push(next as (typeof thread.messages)[number]);
  server.change(thread, "thread.message-sent", {
    threadId: thread.id,
    ...next,
    messageId: next.id,
  });
  await expect
    .poll(() => store.connection.database.prepare("SELECT cursor FROM t3_thread").get()?.["cursor"])
    .toBe(1);
  await source.stop();
  thread.session = { ...thread.session!, status: "ready", activeTurnId: null };
  thread.latestTurn = { ...thread.latestTurn!, state: "completed", completedAt: thread.updatedAt };
  server.change(thread);
  running(thread, "next-turn", next.createdAt);
  server.change(thread);
  const resumed = start();
  await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
  expect(store.pendingInbox("reader").map((r) => r.payload)).toMatchObject([
    { type: "t3.turn.settled", turnId: "first-turn", messageId: first.id },
    { type: "t3.turn.started", turnId: "next-turn", messageId: next.id },
  ]);
  await resumed.stop();
  server.setBound(0);
  thread.messages = [];
  thread.session = { ...thread.session!, status: "ready", activeTurnId: null };
  thread.latestTurn = { ...thread.latestTurn!, state: "completed", completedAt: thread.updatedAt };
  server.change(thread);
  start();
  await expect.poll(() => store.pendingInbox("reader").length).toBe(3);
  expect(store.pendingInbox("reader")[2]!.payload).toMatchObject({
    type: "t3.turn.settled",
    messageId: next.id,
  });
});
test.each(["missing", "ambiguous", "ambiguous-pending"])(
  "never guesses a snapshot attribution with %s messages",
  async (mode) => {
    const { server, store, start } = await setup();
    const thread = fixtureThread();
    running(thread, "first-turn", thread.createdAt);
    if (mode !== "missing") {
      const time = mode === "ambiguous-pending" ? "2026-01-01T00:00:01.000Z" : thread.createdAt;
      thread.messages = [
        userMessage("one", time),
        userMessage("two", time),
      ] as typeof thread.messages;
    }
    server.baseline(thread);
    const source = start();
    await expect.poll(() => source.status()[0]?.state).toBe("following");
    await source.stop();
    server.setBound(0);
    thread.session = { ...thread.session!, status: "ready", activeTurnId: null };
    thread.latestTurn = {
      ...thread.latestTurn!,
      state: "completed",
      completedAt: thread.updatedAt,
    };
    server.change(thread);
    const resumed = start();
    await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
    expect(store.pendingInbox("reader")[0]!.payload).toMatchObject({ messageId: null });
    if (mode === "ambiguous-pending") {
      await resumed.stop();
      server.setBound(1000);
      running(thread, "next-turn", "2026-01-01T00:00:01.000Z");
      server.change(thread);
      start();
      await expect.poll(() => store.pendingInbox("reader").length).toBe(2);
      expect(store.pendingInbox("reader")[1]!.payload).toMatchObject({ messageId: null });
    }
  },
);

test("snapshot attribution retains null for a turn even when a later snapshot reveals a matching message", async () => {
  const { server, store, start } = await setup();
  const thread = fixtureThread();
  running(thread, "first-turn", thread.createdAt);
  server.baseline(thread);
  const source = start();
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  await source.stop();
  server.setBound(0);
  thread.messages.push(
    userMessage("late-evidence", thread.createdAt) as (typeof thread.messages)[number],
  );
  thread.session = { ...thread.session!, status: "ready", activeTurnId: null };
  thread.latestTurn = { ...thread.latestTurn!, state: "completed", completedAt: thread.updatedAt };
  server.change(thread);
  start();
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  expect(store.pendingInbox("reader")[0]!.payload).toMatchObject({ messageId: null });
});
test("a new snapshot turn with ambiguous requesting timestamps publishes null", async () => {
  const { server, store, start } = await setup();
  const source = start();
  await source.ready("station");
  const thread = fixtureThread();
  running(thread, "ambiguous-turn", thread.createdAt);
  thread.messages = [
    userMessage("one", thread.createdAt),
    userMessage("two", thread.createdAt),
  ] as typeof thread.messages;
  server.change(thread);
  await expect.poll(() => store.pendingInbox("reader").length).toBe(1);
  expect(store.pendingInbox("reader")[0]!.payload).toMatchObject({ messageId: null });
});
test("a stopped run with no origin waits for its own baseline on restart", async () => {
  const { server, store, start } = await setup();
  let release!: () => void;
  server.hooks.beforeReadModel = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  const source = start();
  const firstReady = expect(source.ready("station")).rejects.toMatchObject({ kind: "environment" });
  await expect.poll(() => typeof release).toBe("function");
  await source.stop();
  await firstReady;
  expect(store.connection.database.prepare("SELECT * FROM t3_environment").all()).toEqual([]);
  release();
  release = undefined!;
  const resumed = start();
  let ready = false;
  const resumedReady = resumed.ready("station").then(() => {
    ready = true;
  });
  await expect.poll(() => typeof release).toBe("function");
  expect(ready).toBe(false);
  release();
  await resumedReady;
});

test("SIGKILL before the origin commit leaves no readiness and the next run commits its own origin", async () => {
  const { server, store, options, token, directory, start } = await setup();
  server.baseline(fixtureThread());
  const child = fork(
    new URL("./test-fixtures/crash-worker.ts", import.meta.url),
    [
      JSON.stringify({
        path: join(directory, "store.sqlite"),
        token,
        environments: options.environments,
        pause: false,
        pauseOrigin: true,
      }),
    ],
    { silent: true },
  );
  const messages = new Set<unknown>();
  let stderr = "";
  child.stderr!.on("data", (value) => {
    stderr += String(value);
  });
  const insideOrigin = new Promise<void>((resolve, reject) => {
    child.on("message", (message) => {
      messages.add(message);
      if (message === "inside-origin") resolve();
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      reject(new Error(`Worker exited before origin (${code}, ${signal}): ${stderr}`));
    });
  });
  cleanup.push(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
  });
  await insideOrigin;
  expect(messages.has("ready")).toBe(false);
  expect(store.connection.database.prepare("SELECT * FROM t3_environment").all()).toEqual([]);
  const exited = once(child, "exit");
  child.kill("SIGKILL");
  expect(await exited).toEqual([null, "SIGKILL"]);
  server.change(fixtureThread("new-baseline"));
  const source = start();
  await source.ready("station");
  expect(
    store.connection.database.prepare("SELECT origin_sequence FROM t3_environment").get(),
  ).toEqual({ origin_sequence: 1 });
  expect(store.pendingInbox("reader")).toEqual([]);
});

test("ready resets during a changed environment identity until its new origin commits", async () => {
  const { server, store, start } = await setup();
  const source = start();
  await source.ready("station");
  let release!: () => void;
  server.hooks.beforeReadModel = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  await expect
    .poll(() => server.requests.some((request) => request.tag === "orchestration.subscribeShell"))
    .toBe(true);
  server.reset("replacement-server");
  server.failShell();
  await expect.poll(() => typeof release).toBe("function");
  let ready = false;
  const waiting = source.ready("station").then(() => {
    ready = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  expect(ready).toBe(false);
  expect(
    store.connection.database.prepare("SELECT environment_id FROM t3_environment").get(),
  ).toEqual({ environment_id: "server-one" });
  release();
  await waiting;
  expect(
    store.connection.database.prepare("SELECT environment_id FROM t3_environment").get(),
  ).toEqual({ environment_id: "replacement-server" });
});

test("thread view reads stored titles and turn state, encodes thread URLs, and marks archived rows", async () => {
  const { server, store, start, options } = await setup();
  const thread = fixtureThread("thread-one");
  thread.latestTurn = {
    turnId: "turn-one" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "completed",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: thread.createdAt,
    assistantMessageId: null,
  };
  server.baseline(thread);
  const source = start();
  await source.ready("station");
  await expect.poll(() => source.thread("station", "thread-one")?.title).toBe("A recipe");
  expect(source.thread("station", "thread-one")).toEqual({
    title: "A recipe",
    url: `${options.environments.station.url}/server-one/thread-one`,
    turn: "completed",
    archived: false,
  });
  expect(source.thread("unknown", "thread-one")).toBeUndefined();
  expect(source.thread("station", "missing")).toBeUndefined();
  const db = store.connection.database;
  db.prepare("UPDATE t3_thread SET thread_id=?, status='archived' WHERE thread_id=?").run(
    "a/b snow",
    "thread-one",
  );
  db.prepare("UPDATE t3_environment SET environment_id=? WHERE environment=?").run(
    "server/one",
    "station",
  );
  expect(source.thread("station", "a/b snow")).toMatchObject({
    url: `${options.environments.station.url}/server%2Fone/a%2Fb%20snow`,
    archived: true,
  });
  db.prepare("UPDATE t3_thread SET status='deleted' WHERE thread_id=?").run("a/b snow");
  expect(source.thread("station", "a/b snow")?.archived).toBe(true);
});

test("message placement runs in the publication transaction before turn changes", async () => {
  const f = await setup();
  const placements: unknown[] = [];
  const source = startT3CodeSource({
    ...f.options,
    messagePlaced(placement) {
      expect(f.store.connection.database.isTransaction).toBe(true);
      expect(f.store.pendingInbox("reader")).toHaveLength(0);
      placements.push(placement);
    },
  });
  cleanup.push(() => source.stop());
  expect(await source.environmentId("station")).toBe("server-one");
  const base = fixtureThread();
  const thread = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...base,
    messages: [
      {
        id: "answer",
        role: "user",
        turnId: null,
        streaming: false,
        text: "Selected option",
        attachments: [],
        createdAt: base.createdAt,
        updatedAt: base.createdAt,
      },
    ],
    latestTurn: {
      turnId: "answer-turn",
      state: "completed",
      requestedAt: base.createdAt,
      startedAt: base.createdAt,
      completedAt: base.createdAt,
      assistantMessageId: null,
    },
  });
  f.server.change(thread);
  await expect
    .poll(() => placements)
    .toEqual([
      {
        environment: "station",
        threadId: thread.id,
        messageId: "answer",
        turnId: "answer-turn",
        placement: "started",
      },
    ]);
  await expect.poll(() => f.store.pendingInbox("reader").length).toBe(2);
});
test("projects reflect shell snapshots and live project edits with followed thread counts", async () => {
  const { server, start } = await setup();
  server.projects.set("project", {
    id: "project",
    title: "Garden",
    workspaceRoot: "/tmp/garden",
    defaultModelSelection: null,
    deletedAt: null,
    scripts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  const thread = fixtureThread();
  server.baseline(thread);
  let reads = 0;
  server.hooks.readModel = () => {
    reads++;
  };
  const source = start();
  expect(source.projects("station")).toBeUndefined();
  expect(source.projects("absent")).toBeUndefined();
  await expect
    .poll(() => source.projects("station"))
    .toEqual([{ id: "project", title: "Garden", workspaceRoot: "/tmp/garden", activeThreads: 1 }]);
  server.project({
    id: "project",
    title: "Orchard",
    workspaceRoot: "/tmp/orchard",
    defaultModelSelection: null,
    deletedAt: null,
    scripts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await expect.poll(() => source.projects("station")?.[0]?.title).toBe("Orchard");
  thread.archivedAt = thread.createdAt;
  server.change(thread, "thread.archived", { threadId: thread.id, archivedAt: thread.archivedAt });
  await expect.poll(() => source.projects("station")?.[0]?.activeThreads).toBe(0);
  server.removeProject("project");
  await expect.poll(() => source.projects("station")).toEqual([]);
  server.failShell();
  server.projects.set("project", {
    id: "project",
    title: "Meadow",
    workspaceRoot: "/tmp/meadow",
    defaultModelSelection: null,
    deletedAt: null,
    scripts: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
  await expect.poll(() => reads).toBe(2);
  await expect.poll(() => source.projects("station")?.[0]?.title).toBe("Meadow");
});

function operatorHolds(disconnected = false) {
  let current = { paused: false, disconnected, sequence: 0 };
  const waits = new Set<() => void>();
  return {
    held: () => current,
    changed(_environment: string, after: number, signal?: AbortSignal) {
      if (current.sequence !== after) return Promise.resolve();
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise<void>((resolve, reject) => {
        const finish = () => {
          waits.delete(finish);
          signal?.removeEventListener("abort", aborted);
          resolve();
        };
        const aborted = () => {
          waits.delete(finish);
          reject(signal?.reason);
        };
        waits.add(finish);
        signal?.addEventListener("abort", aborted, { once: true });
      });
    },
    set(change: Partial<{ paused: boolean; disconnected: boolean }>) {
      current = { ...current, ...change, sequence: current.sequence + 1 };
      for (const finish of waits) finish();
    },
    waiting: () => waits.size,
  };
}

test("a disconnected hold waits without connecting and resumes immediately; pause keeps following", async () => {
  const { server, options } = await setup();
  const holds = operatorHolds(true);
  const source = startT3CodeSource({ ...options, holds });
  cleanup.push(() => source.stop());
  await expect.poll(() => source.status()[0]?.state).toBe("disconnected");
  expect(server.requests).toHaveLength(0);
  let ready = false;
  void source.ready("station").then(() => {
    ready = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(ready).toBe(false);
  holds.set({ disconnected: false });
  await source.ready("station");
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  holds.set({ paused: true });
  await expect.poll(() => holds.waiting()).toBe(1);
  expect(source.status()[0]?.state).toBe("following");
  await source.stop();
  expect(holds.waiting()).toBe(0);
});

test("disconnect aborts admitted writes, preserves cursors, and replays settlement once", async () => {
  const { server, store, options } = await setup();
  const holds = operatorHolds();
  const thread = fixtureThread();
  thread.latestTurn = {
    turnId: "turn-one" as NonNullable<typeof thread.latestTurn>["turnId"],
    state: "running",
    requestedAt: thread.createdAt,
    startedAt: thread.createdAt,
    completedAt: null,
    assistantMessageId: null,
  };
  thread.session = {
    threadId: thread.id,
    status: "running",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: thread.latestTurn.turnId,
    lastError: null,
    updatedAt: thread.createdAt,
  };
  server.baseline(thread);
  const source = startT3CodeSource({
    ...options,
    holds,
    environments: {
      station: {
        ...options.environments.station,
        reconnect: { initialMs: 10000, factor: 2, maxMs: 20000, jitter: 0 },
      },
    },
  });
  cleanup.push(() => source.stop());
  await source.ready("station");
  await expect.poll(() => source.status()[0]?.activeThreads).toBe(1);
  let admitted = false;
  const write = source.write("station", thread.id, new AbortController().signal, async () => {
    admitted = true;
    return new Promise<void>(() => {});
  });
  const interrupted = expect(write).rejects.toMatchObject({ name: "T3ConnectionError" });
  await expect.poll(() => admitted).toBe(true);
  holds.set({ disconnected: true });
  await expect.poll(() => source.status()[0]?.state).toBe("disconnected");
  await interrupted;
  await expect.poll(() => source.status()[0]?.openSubscriptions).toBe(0);
  thread.latestTurn = { ...thread.latestTurn, state: "completed", completedAt: thread.createdAt };
  thread.session = { ...thread.session, status: "ready", activeTurnId: null };
  server.change(thread);
  holds.set({ disconnected: false });
  await source.ready("station");
  await expect.poll(() => source.status()[0]?.activeThreads).toBe(0);
  await expect
    .poll(() => store.pendingInbox("reader").map((row) => row.payload))
    .toMatchObject([{ type: "t3.turn.settled" }]);
});

test("restart resumes a stopped environment and has no effect on one already following", async () => {
  const { server, options } = await setup();
  let reject = true;
  const source = startT3CodeSource({
    ...options,
    router: {
      ...options.router,
      publish(event) {
        return reject ? { status: "rejected", issues: [] } : options.router.publish(event);
      },
    },
  });
  cleanup.push(() => source.stop());
  await source.ready("station");
  const thread = fixtureThread();
  thread.session = {
    threadId: thread.id,
    status: "error",
    providerName: "provider",
    runtimeMode: "full-access",
    activeTurnId: null,
    lastError: "fixture",
    updatedAt: thread.createdAt,
  };
  server.change(thread);
  await expect.poll(() => source.status()[0]?.state).toBe("stopped");
  reject = false;
  source.restart("station");
  await source.ready("station");
  await expect.poll(() => source.status()[0]?.state).toBe("following");
  const requests = server.requests.length;
  source.restart("station");
  expect(source.status()[0]?.state).toBe("following");
  expect(server.requests).toHaveLength(requests);
});

test("write admission sees a disconnect committed after readiness resolves", async () => {
  const { options } = await setup();
  const holds = operatorHolds();
  let armed = false;
  let reads = 0;
  const source = startT3CodeSource({
    ...options,
    holds: {
      ...holds,
      held() {
        if (armed && ++reads === 2) holds.set({ disconnected: true });
        return holds.held();
      },
    },
  });
  cleanup.push(() => source.stop());
  await source.ready("station");
  armed = true;
  let sent = false;
  const abort = new AbortController();
  const write = source.write("station", "conversation", abort.signal, async () => {
    sent = true;
  });
  const outcome = write.then(
    () => "sent",
    (error: unknown) => error,
  );
  try {
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(sent).toBe(false);
  } finally {
    abort.abort("fixture-abort");
    await outcome;
  }
  expect(await outcome).toBe("fixture-abort");
});

test("write admission uses the sequence read before a reconnect commits", async () => {
  const { options } = await setup();
  const holds = operatorHolds();
  let armed = false;
  let reads = 0;
  const source = startT3CodeSource({
    ...options,
    holds: {
      ...holds,
      held() {
        if (armed && ++reads === 2) {
          holds.set({ disconnected: true });
          const snapshot = holds.held();
          holds.set({ disconnected: false });
          return snapshot;
        }
        return holds.held();
      },
    },
  });
  cleanup.push(() => source.stop());
  await source.ready("station");
  armed = true;
  let sent = false;
  const abort = new AbortController();
  const write = source.write("station", "conversation", abort.signal, async () => {
    sent = true;
  });
  const outcome = write.then(
    () => "sent",
    () => "aborted",
  );
  try {
    await expect.poll(() => sent).toBe(true);
  } finally {
    abort.abort("fixture-abort");
    await outcome;
  }
});

test("a server unavailable during initial connection exposes and forwards its diagnostic", async () => {
  const { server, options } = await setup();
  server.hooks.ticketStatus = 503;
  const warnings: { message: string; data?: Record<string, unknown> }[] = [];
  const source = startT3CodeSource({
    ...options,
    logger: {
      debug() {},
      info() {},
      error() {},
      warn(message, data) {
        warnings.push({ message, ...(data ? { data } : {}) });
      },
    },
  });
  cleanup.push(() => source.stop());
  await expect.poll(() => source.status()[0]?.error).toBeDefined();
  const diagnostic = warnings.find((warning) => typeof warning.data?.["error"] === "string");
  expect(diagnostic).toBeDefined();
  expect(source.status()[0]?.error).toBe(diagnostic?.data?.["error"]);
  expect(source.status()[0]?.state).toBe("connecting");
  delete server.hooks.ticketStatus;
  await source.ready("station");
  expect(source.status()[0]?.error).toBeUndefined();
});
