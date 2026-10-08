// ---
// relationships:
//   verifies: [agent-threads, durable-event-delivery, t3code-environment-source]
// ---
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fork } from "node:child_process";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, test, inject } from "vite-plus/test";
import { commandServer } from "./test-fixtures/commands.ts";
import { fixtureService } from "./test-fixtures/service.ts";
import type { FixtureConfiguration } from "./test-fixtures/service.ts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).toReversed()) await close();
});
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "thread-recovery-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const token = join(directory, "token");
  await writeFile(token, "fixture-token");
  const server = await commandServer();
  cleanup.push(() => server.close());
  const config: FixtureConfiguration = {
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
  return { server, config };
}
test("source readiness precedes a fast turn and settlement before invoke onDone", async () => {
  const { server, config } = await setup();
  let release!: () => void;
  server.hooks.beforeReadModel = () =>
    new Promise<void>((resolve) => {
      release = resolve;
    });
  server.commandHooks.accepted = (command) => {
    if (command.type === "thread.turn.start") server.settle(command.threadId);
  };
  let responseHeld = false;
  server.hooks.beforeDispatchResponse = async (command) => {
    if ((command as { type: string }).type === "thread.turn.start") {
      responseHeld = true;
      await new Promise<void>((resolve) => {
        const subscription = service.actor.subscribe((snapshot) => {
          if (snapshot.status === "done") {
            subscription.unsubscribe();
            resolve();
          }
        });
      });
    }
  };
  const service = await fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => typeof release).toBe("function");
  expect(server.commands).toHaveLength(0);
  release();
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
  expect(responseHeld).toBe(true);
  const commands = service.history.read("worker")!.commands;
  expect(commands.map((command) => command.kind)).toEqual(["thread-create", "turn-start"]);
  expect(commands[1]).toMatchObject({
    turnId: [...server.threads.values()][0]!.latestTurn!.turnId,
  });
  expect(commands[1]).not.toHaveProperty("acceptedAt");
  cleanup.pop();
  await service.stop();
  const restarted = await fixtureService(config);
  cleanup.push(() => restarted.stop());
  expect(restarted.history.read("worker")!.commands).toEqual(commands);
  expect(server.threads.size).toBe(1);
  expect([...server.threads.values()][0]!.messages).toHaveLength(1);
  expect(restarted.actor.getSnapshot().context.started).toBe(1);
});
test("turn shell read cannot carry a send into a replacement origin", async () => {
  const { server, config } = await setup();
  let releaseShell!: () => void;
  server.hooks.beforeShellRead = () =>
    new Promise<void>((resolve) => {
      releaseShell = resolve;
    });
  const service = await fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => typeof releaseShell).toBe("function");
  let releaseOrigin!: () => void;
  server.hooks.beforeReadModel = () =>
    new Promise<void>((resolve) => {
      releaseOrigin = resolve;
    });
  server.setIdentity("server-two");
  server.failShell();
  await expect.poll(() => typeof releaseOrigin).toBe("function");
  let acceptedOrigin: unknown;
  server.commandHooks.accepted = (command) => {
    if (command.type === "thread.turn.start")
      acceptedOrigin = service.store.connection.database
        .prepare("SELECT environment_id FROM t3_environment WHERE environment = ?")
        .get("station")?.["environment_id"];
  };
  delete server.hooks.beforeShellRead;
  releaseShell();
  // Allow the released shell read to complete while the origin remains held.
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(server.commands.filter((command) => command.type === "thread.turn.start")).toHaveLength(0);
  releaseOrigin();
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  expect(server.commands.filter((command) => command.type === "thread.turn.start")).toHaveLength(1);
  expect(acceptedOrigin).toBe("server-two");
  server.settle(service.actor.getSnapshot().context.thread);
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
});
test("guard ignores old, other-thread and ambiguous settlements then takes its turn", async () => {
  const { server, config } = await setup();
  const service = await fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  const context = service.actor.getSnapshot().context;
  for (const [threadId, messageId] of [
    [context.thread, "old-message"],
    ["other", context.message],
    [context.thread, null],
  ] as const) {
    service.router.publish({
      source: "fixture",
      eventId: `${threadId}:${messageId}`,
      topics: [`t3.environment.station.thread.${context.thread}`],
      event: { type: "t3.turn.settled", threadId, messageId },
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  }
  server.settle(context.thread);
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
});
test("an admitted successful command survives identity replacement and restart with one settlement", async () => {
  const { server, config } = await setup();
  let releaseShell!: () => void;
  server.hooks.beforeShellRead = () =>
    new Promise<void>((resolve) => {
      releaseShell = resolve;
    });
  let releaseWrite!: () => void;
  let held = false;
  server.hooks.beforeDispatchResponse = (command) =>
    (command as { type: string }).type === "thread.turn.start" && !held
      ? new Promise<void>((resolve) => {
          held = true;
          releaseWrite = resolve;
        })
      : Promise.resolve();
  let service = await fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => typeof releaseShell).toBe("function");
  await expect
    .poll(
      () =>
        service.store.connection.database
          .prepare("SELECT count(*) AS count FROM t3_thread WHERE thread IS NOT NULL")
          .get()?.["count"],
    )
    .toBe(1);
  server.hooks.deliverThreadItems = () => false;
  delete server.hooks.beforeShellRead;
  releaseShell();
  await expect.poll(() => typeof releaseWrite).toBe("function");
  const thread = [...server.threads.values()][0]!;
  server.settle(thread.id);
  let originRead = false;
  server.hooks.beforeReadModel = async () => {
    originRead = true;
  };
  server.setIdentity("server-two");
  server.failShell();
  await expect.poll(() => originRead).toBe(true);
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  delete server.hooks.beforeDispatchResponse;
  releaseWrite();
  await service.source.ready("station");
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  await service.stop();
  delete server.hooks.deliverThreadItems;
  service = await fixtureService(config);
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
  expect(server.commands.filter((command) => command.type === "thread.turn.start")).toHaveLength(2);
  expect(thread.messages).toHaveLength(1);
  const settlements = service.store.connection.database
    .prepare(
      "SELECT count(*) AS count FROM store_inbox WHERE actor_id = ? AND json_extract(payload, '$.type') = ?",
    )
    .get("worker", "t3.turn.settled");
  expect(settlements?.["count"]).toBe(1);
});
test("dropped response retries the exact command and gives one turn", async () => {
  const { server, config } = await setup();
  let dropped = false;
  server.commandHooks.accepted = (command) => {
    if (command.type === "thread.turn.start" && !dropped) {
      dropped = true;
      server.drop();
    }
  };
  const service = await fixtureService(config);
  cleanup.push(() => service.stop());
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  const turns = server.commands.filter((command) => command.type === "thread.turn.start");
  expect(turns).toHaveLength(2);
  expect(turns[0]).toEqual(turns[1]);
  expect([...server.threads.values()][0]!.messages).toHaveLength(1);
  server.settle(service.actor.getSnapshot().context.thread);
  await expect.poll(() => service.actor.getSnapshot().status).toBe("done");
});
test.each(["t3code-project-create", "thread-create", "turn-start"] as const)(
  "SIGKILL after %s receipt restores one thread and one turn",
  async (crash) => {
    const { server, config } = await setup();
    function start(crash?: FixtureConfiguration["crash"]) {
      const child = fork(
        join(inject("childArtifacts").service!, "agent-threads/test-fixtures/crash-worker.js"),
        [
          JSON.stringify({
            ...config,
            projectCreate: crash === "t3code-project-create" || config.projectCreate,
            crash,
          }),
        ],
        { execArgv: [], stdio: ["ignore", "pipe", "pipe", "ipc"] },
      );
      let error = "";
      child.stderr?.on("data", (chunk) => {
        error += String(chunk);
      });
      const messages: unknown[] = [];
      child.on("message", (message) => messages.push(message));
      cleanup.push(async () => {
        if (child.exitCode === null && child.signalCode === null) {
          const exited = once(child, "exit");
          child.kill("SIGKILL");
          await exited;
        }
      });
      function waitFor(predicate: (message: unknown) => boolean): Promise<void> {
        if (messages.some(predicate)) return Promise.resolve();
        return new Promise<void>((resolve, reject) => {
          const detach = () => {
            child.off("message", received);
            child.off("exit", exited);
            child.off("error", failed);
          };
          const received = (message: unknown) => {
            if (predicate(message)) {
              detach();
              resolve();
            }
          };
          const exited = (code: number | null, signal: NodeJS.Signals | null) => {
            detach();
            reject(new Error(`Worker exited before expected state (${code}, ${signal}): ${error}`));
          };
          const failed = (cause: Error) => {
            detach();
            reject(cause);
          };
          child.on("message", received);
          child.once("exit", exited);
          child.once("error", failed);
        });
      }
      return { child, waitFor, error: () => error };
    }
    if (crash === "t3code-project-create") config.projectCreate = true;
    const first = start(crash);
    const [, signal] = await once(first.child, "exit");
    expect(signal, first.error()).toBe("SIGKILL");
    if (crash === "t3code-project-create") {
      expect(server.projects.size).toBe(1);
      const db = new DatabaseSync(config.path);
      try {
        expect(db.prepare("SELECT * FROM t3_created_project").all()).toEqual([]);
      } finally {
        db.close();
      }
    }
    const resumed = start();
    await resumed.waitFor((message) => JSON.stringify(message).includes("waiting"));
    expect(server.commands.filter((command) => command.type === "thread.turn.start")).toHaveLength(
      crash === "turn-start" ? 2 : 1,
    );
    if (crash === "t3code-project-create") {
      expect(server.projects.size).toBe(1);
      expect(server.commands.filter((c) => c.type === "project.create")).toHaveLength(2);
      const db = new DatabaseSync(config.path);
      try {
        expect(db.prepare("SELECT * FROM t3_created_project").all()).toEqual([
          {
            environment: "station",
            project_id: [...server.projects.keys()][0],
            actor_id: "worker",
            item: "beta",
          },
        ]);
      } finally {
        db.close();
      }
    }
    expect(server.threads.size).toBe(1);
    const thread = [...server.threads.values()][0]!;
    expect(thread.messages).toHaveLength(1);
    server.settle(thread.id);
    await resumed.waitFor((message) => JSON.stringify(message).includes('"value":"done"'));
    const exiting = once(resumed.child, "exit");
    resumed.child.send("stop");
    await exiting;
  },
);

test("task creates a templated project, attributes it, and starts its thread there", async () => {
  const { server, config } = await setup();
  const service = await fixtureService({ ...config, projectCreate: true });
  cleanup.push(() => service.stop());
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  expect(server.projects.size).toBe(1);
  const project = [...server.projects.values()][0]!;
  expect(project).toMatchObject({ title: "Parcel sample", workspaceRoot: "/work/sample" });
  expect([...server.threads.values()][0]!.projectId).toBe(project["id"]);
  expect(service.source.createdProject("station", String(project["id"]))).toMatchObject({
    actorId: "worker",
    item: "beta",
  });
  expect(
    service.portfolio.t3codeProject({ environment: "station", id: String(project["id"]) }),
  ).toEqual({ item: "beta", via: "created", actorId: "worker" });
});
test.each([
  { title: "{{ absent }}", kind: "template" },
  { workspaceRoot: "relative", kind: "template" },
  { workspaceRoot: "{{ empty }}", values: { empty: " ", parcel: "sample" }, kind: "template" },
  { createWorkspaceRoot: false, kind: "rejected" },
])(
  "failed project create takes the error transition with no attribution or thread: %j",
  async ({ kind, ...projectInput }) => {
    const { server, config } = await setup();
    const service = await fixtureService({ ...config, projectCreate: true, projectInput });
    cleanup.push(() => service.stop());
    await expect.poll(() => service.actor.getSnapshot().value).toBe("failed");
    expect(service.actor.getSnapshot().context.error).toMatchObject({ kind });
    expect(server.projects.size).toBe(0);
    expect(server.threads.size).toBe(0);
    expect(
      service.store.connection.database.prepare("SELECT * FROM t3_created_project").all(),
    ).toEqual([]);
  },
);
test("dropped project acceptance retries the same command and saves one association", async () => {
  const { server, config } = await setup();
  let dropped = false;
  server.commandHooks.accepted = (command) => {
    if (command.type === "project.create" && !dropped) {
      dropped = true;
      server.drop();
    }
  };
  const service = await fixtureService({ ...config, projectCreate: true });
  cleanup.push(() => service.stop());
  await expect.poll(() => service.actor.getSnapshot().value).toEqual({ working: "waiting" });
  const commands = server.commands.filter((command) => command.type === "project.create");
  expect(commands).toHaveLength(2);
  expect(commands[0]).toEqual(commands[1]);
  expect(server.projects.size).toBe(1);
  expect(
    service.store.connection.database.prepare("SELECT * FROM t3_created_project").all(),
  ).toHaveLength(1);
});

test.each(["file", "occupied"])(
  "project root %s is rejected without attribution or a thread",
  async (kind) => {
    const { server, config } = await setup();
    const root = "/work/sample";
    if (kind === "file") server.files.add(root);
    else {
      server.roots.add(root);
      server.project({
        id: "existing",
        title: "Another parcel",
        workspaceRoot: root,
        defaultModelSelection: null,
        scripts: [],
        deletedAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }
    const service = await fixtureService({ ...config, projectCreate: true });
    cleanup.push(() => service.stop());
    await expect.poll(() => service.actor.getSnapshot().value).toBe("failed");
    expect(service.actor.getSnapshot().context.error).toMatchObject({
      kind: "rejected",
      serverMessage: expect.stringContaining(
        kind === "file" ? "not a directory" : "already has a project",
      ),
    });
    expect(server.threads.size).toBe(0);
    expect(
      service.store.connection.database.prepare("SELECT * FROM t3_created_project").all(),
    ).toEqual([]);
  },
);
