// ---
// relationships:
//   verifies: t3code-environment-source
// ---
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
    },
    {
      type: "t3.turn.settled",
      environment: "station",
      threadId: thread.id,
      projectId: "project",
      turnId: "turn-one",
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
    child.on("message", (message) => messages.add(message));
    cleanup.push(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit");
        child.kill("SIGKILL");
        await exit;
      }
    });
    return { child, messages, stderr: () => stderr };
  }
  const first = worker(true);
  await expect
    .poll(() => ({ ready: first.messages.has("following"), error: first.stderr() }))
    .toMatchObject({ ready: true });
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
  await expect.poll(() => again.messages.has("following")).toBe(true);
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
    },
    {
      type: "t3.turn.settled",
      environment: "station",
      threadId: thread.id,
      projectId: "project",
      turnId: "older-turn",
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
    ).toEqual({ version: 1 });
  } finally {
    reference.close();
  }
});
