// ---
// relationships:
//   verifies: [tasks-api, operator-console, durable-event-delivery]
// ---
import { expect, test } from "vite-plus/test";
import { openTasks } from "./index.ts";
import { fixture } from "../escalations/test-support.ts";
import { startRouter } from "../router/index.ts";
import { consoleHost } from "../console/test-fixtures/host.ts";

const project = {
  binding: "sample",
  owner: "example",
  number: 1,
  item: "deliveries",
  lifecycle: { field: "Stage", options: ["Ready", "Delivered"] },
};
const issue = {
  nodeId: "parcel",
  repository: "example/delivery",
  number: 2,
  state: "open" as const,
  title: "Deliver parcel",
  url: "https://example.test/issues/2",
};
const tracked = {
  issue,
  items: [
    { project, archived: false, fields: { Stage: { kind: "single-select", name: "Ready" } } },
  ],
};

test("reads tasks through the HTTP host and uses current router holds, including restore refusal and recovery", async () => {
  const f = fixture();
  const server = await consoleHost();
  f.store.saveSnapshot({
    actorId: "task:parcel",
    machine: `${"b".repeat(40)}:blueprints/delivery.yml`,
    snapshot: {
      status: "active",
      value: { delivery: "ready" },
      context: {
        manifold: {
          portfolioItem: "deliveries",
          environment: "sample-host",
          threads: ["thread-1"],
        },
      },
    },
  });
  let refused = true;
  const router = startRouter({
    store: f.store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: (stored) =>
        refused
          ? { status: "held", reason: "Unavailable" }
          : {
              status: "restored",
              target: {
                actorId: stored.actorId,
                send: () => {},
                persist: () => ({ machine: stored.machine, snapshot: stored.snapshot }),
              },
            },
    },
  });
  try {
    const open = f.module.raise({
      kind: "held-actor",
      subject: { actorId: "task:parcel" },
      question: "Deliver?",
      choices: [{ id: "yes", label: "Yes" }],
    });
    const tasks = openTasks({
      store: f.store,
      held: (id) => Boolean(router.held(id)),
      boundProjects: () => [project],
      github: { trackedIssueIds: () => [issue.nodeId], trackedIssue: () => tracked },
      actorUsage: () => ({
        settled: true,
        accounts: [{ account: "sample", estimate: 10, actual: 12, variance: 2, outstanding: 0 }],
      }),
      listEscalations: f.module.list,
      thread: () => ({
        title: "Delivery",
        url: "https://example.test/env/thread-1",
        turn: "completed",
        archived: false,
      }),
      tokenHolder: () => undefined,
    });
    server.host.mount("/api/tasks", tasks.requestListener);
    const list = await fetch(server.url + "/api/tasks?ignored=yes");
    expect(list.headers.get("cache-control")).toBe("no-store");
    expect(await list.json()).toMatchObject({
      projects: [
        {
          tasks: [
            {
              actorId: "task:parcel",
              status: "Ready",
              actor: { status: "held", states: ["delivery.ready"] },
              openEscalations: 1,
            },
          ],
        },
      ],
    });
    expect(f.store.loadErroredSnapshot("task:parcel")).toBeUndefined();
    f.store.saveSnapshot({
      actorId: "task:parcel",
      machine: "failed",
      snapshot: { status: "error", error: "failure" },
    });
    refused = false;
    router.release("task:parcel");
    const detail = await fetch(server.url + "/api/tasks/task%3Aparcel");
    expect(await detail.json()).toMatchObject({
      task: {
        issue,
        actor: { status: "active" },
        threads: [{ threadId: "thread-1", title: "Delivery" }],
        usage: { settled: true, accounts: [{ reserved: 0, variance: 2 }] },
        escalations: { open: [open] },
      },
    });
    expect(f.store.loadErroredSnapshot("task:parcel")).toBeDefined();
    for (const path of ["/task%3Amissing", "/other", "/task%3Aparcel/extra", "/%XX"])
      expect((await fetch(server.url + "/api/tasks" + path)).status).toBe(404);
    const post = await fetch(server.url + "/api/tasks", { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET");
  } finally {
    router.stop();
    await server.close();
    await f.close();
  }
});

test("an errored delivery holds the actor until release restores it, while historical errors remain inspectable", async () => {
  const f = fixture();
  const write = {
    actorId: "task:parcel",
    machine: "delivery",
    snapshot: { status: "active" as const, value: "ready", context: {} },
  };
  f.store.saveSnapshot(write);
  let failing = false;
  let sends = 0;
  const router = startRouter({
    store: f.store,
    host: {
      subscription: () => ({ topics: ["delivery"] }),
      restore: (stored) => ({
        status: "restored",
        target: {
          actorId: stored.actorId,
          send: () => {
            failing = sends++ === 0;
          },
          persist: () => ({
            machine: stored.machine,
            snapshot: failing ? { status: "error", error: "failed delivery" } : write.snapshot,
          }),
        },
      }),
    },
  });
  try {
    const tasks = openTasks({
      store: f.store,
      held: (id) => Boolean(router.held(id)),
      boundProjects: () => [project],
      github: { trackedIssueIds: () => ["parcel"], trackedIssue: () => tracked },
      actorUsage: () => ({ settled: false, accounts: [] }),
      listEscalations: () => [],
      thread: () => undefined,
      tokenHolder: () => undefined,
    });
    router.publish({
      source: "delivery",
      eventId: "one",
      topics: ["delivery"],
      event: { type: "delivery.failed" },
    });
    await expect
      .poll(() => router.held("task:parcel")?.reason)
      .toBe("Actor returned an errored snapshot");
    expect(tasks.get("task:parcel")?.task.actor?.status).toBe("held");
    failing = false;
    router.release("task:parcel");
    await expect.poll(() => f.store.pendingInbox("task:parcel").length).toBe(0);
    expect(router.held("task:parcel")).toBeUndefined();
    expect(tasks.get("task:parcel")?.task.actor?.status).toBe("active");
    expect(f.store.loadErroredSnapshot("task:parcel")).toBeDefined();
  } finally {
    router.stop();
    await f.close();
  }
});
