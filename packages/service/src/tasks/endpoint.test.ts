// ---
// relationships:
//   verifies: [tasks-api, operator-console]
// ---
import { expect, test } from "vite-plus/test";
import { isTasksResponse, isTaskResponse } from "@wyrd-company/manifold-shared/tasks-api";
import { boardWorld } from "./test-fixtures/world.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";
import { openTasks } from "./index.ts";

test("reads a populated mirror, settled ledger on two accounts, pending intake, and per-Project lifecycle values over HTTP", async () => {
  const f = boardWorld(),
    server = await consoleHost();
  try {
    server.host.mount("/api/tasks", f.tasks.requestListener);
    const list = await fetch(server.url + "/api/tasks"),
      body = await list.json();
    expect(list.headers.get("content-type")).toBe("application/json");
    expect(isTasksResponse(body)).toBe(true);
    if (!isTasksResponse(body)) throw new Error("Invalid response");
    expect(body.projects.map((p) => p.binding)).toEqual(["delivery", "secondary"]);
    expect(body.projects[0]?.tasks.map((t) => [t.actorId, t.status, t.openEscalations])).toEqual([
      ["task:waiting", null, 0],
      ["task:parcel", "Ready", 1],
    ]);
    expect(body.projects[0]?.tasks[0]?.actor).toBeUndefined();
    expect(body.projects[1]?.tasks.map((t) => [t.actorId, t.status])).toEqual([
      ["task:parcel", null],
    ]);
    const detail = await (await fetch(server.url + "/api/tasks/task:parcel")).json();
    expect(isTaskResponse(detail)).toBe(true);
    if (!isTaskResponse(detail)) throw new Error("Invalid response");
    expect(detail.task.projects).toEqual([
      { binding: "delivery", owner: "example", number: 1, field: "Stage", status: "Ready" },
      { binding: "secondary", owner: "example", number: 2, status: null },
    ]);
    expect(detail.task.usage).toEqual({
      settled: true,
      accounts: [
        { account: "sample", estimate: 10, actual: 12, variance: 2, reserved: 0 },
        { account: "second", estimate: 10, actual: 12, variance: 2, reserved: 0 },
      ],
    });
    expect(detail.task.threads).toEqual([
      {
        threadId: "thread-1",
        environment: "sample-host",
        title: "Parcel delivery",
        url: "https://example.test/environment/thread-1",
        turn: "completed",
        archived: false,
      },
      { threadId: "unfollowed", environment: "sample-host" },
    ]);
    expect(f.tasks.get("task:waiting")?.task).toMatchObject({
      threads: [],
      usage: { settled: false, accounts: [] },
      escalations: { open: [], recent: [] },
    });
    const held = f.module.raise({
      kind: "held-actor",
      subject: { actorId: "task:parcel" },
      question: "Try delivery?",
      choices: [{ id: "yes", label: "Yes" }],
    });
    const stranded = f.module.raise({
      kind: "stranded-token",
      subject: { tokenId: "sample-token" },
      question: "Return parcel?",
      choices: [{ id: "yes", label: "Yes" }],
    });
    f.module.raise({
      kind: "held-actor",
      subject: { actorId: "task:other" },
      question: "Other?",
      choices: [{ id: "yes", label: "Yes" }],
    });
    expect(f.tasks.get("task:parcel")?.task.escalations.open.map((e) => e.id)).toEqual([
      f.escalation.id,
      held.id,
      stranded.id,
    ]);
    f.module.answer(held.id, { choice: "yes" }, "link");
    expect(f.tasks.get("task:parcel")?.task.escalations.recent[0]?.answer?.channel).toBe("link");
    const current = f.mirror.read(),
      next = f.mirror.read();
    const [key, field] = [...next.fields][0]!;
    next.fields.set(key, { ...field, value: { kind: "text", text: "Ready" } });
    f.mirror.write(current, next);
    expect(
      f.tasks.list().projects[0]?.tasks.find((t) => t.actorId === "task:parcel")?.status,
    ).toBeNull();
  } finally {
    await server.close();
    await f.close();
  }
});

test("read failures log the path and return 500 without details", async () => {
  const server = await consoleHost(),
    logs: unknown[] = [];
  try {
    const tasks = openTasks({
      store: { loadSnapshot: () => undefined },
      held: () => false,
      boundProjects: () => {
        throw new Error("store unavailable");
      },
      github: { trackedIssueIds: () => [], trackedIssue: () => undefined },
      actorUsage: () => ({ settled: false, accounts: [] }),
      listEscalations: () => [],
      thread: () => undefined,
      tokenHolder: () => undefined,
      log: (entry) => logs.push(entry),
    });
    server.host.mount("/api/tasks", tasks.requestListener);
    const result = await fetch(server.url + "/api/tasks");
    expect(result.status).toBe(500);
    expect(await result.text()).toBe("");
    expect(logs).toEqual([{ level: "error", path: "/api/tasks", error: "store unavailable" }]);
  } finally {
    await server.close();
  }
});

test("task escalation association includes issue subjects and returned-token holders, orders outcomes, and caps recent history", async () => {
  const f = boardWorld();
  try {
    const sample = f.escalation;
    const escalations = [
      {
        ...sample,
        id: "issue-question",
        raiser: {
          type: "service" as const,
          kind: "intake-failed" as const,
          subject: { issue: "parcel" },
          occurrence: 1,
        },
        raisedAt: 1,
      },
      {
        ...sample,
        id: "token-question",
        raiser: {
          type: "service" as const,
          kind: "stranded-token" as const,
          subject: { tokenId: "returned-token" },
          occurrence: 1,
        },
        raisedAt: 0,
      },
      {
        ...sample,
        id: "unrelated",
        raiser: {
          type: "blueprint" as const,
          actorId: "task:other",
          invokeId: "ask",
          entryId: "one",
        },
      },
      ...Array.from({ length: 25 }, (_, i) => ({
        ...sample,
        id: `closed-${i}`,
        status: "withdrawn" as const,
        closedAt: i,
        raisedAt: 0,
      })),
    ];
    const tasks = openTasks({
      store: f.store,
      held: () => false,
      boundProjects: () => f.projects,
      github: {
        trackedIssueIds: () => ["parcel"],
        trackedIssue: () => ({
          issue: { nodeId: "parcel", repository: "example/delivery", number: 1, state: "open" },
          items: [{ project: f.projects[0]!, archived: false, fields: {} }],
        }),
      },
      actorUsage: f.ledger.actorUsage,
      listEscalations: () => escalations,
      thread: () => undefined,
      tokenHolder: (id) => (id === "returned-token" ? "task:parcel" : undefined),
    });
    const detail = tasks.get("task:parcel")!.task;
    expect(detail.escalations.open.map((e) => e.id)).toEqual(["token-question", "issue-question"]);
    expect(detail.escalations.recent.map((e) => e.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `closed-${24 - i}`),
    );
    expect(tasks.list().projects[0]?.tasks[0]?.openEscalations).toBe(2);
  } finally {
    await f.close();
  }
});
