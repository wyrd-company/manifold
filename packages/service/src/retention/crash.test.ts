// ---
// relationships:
//   verifies: [retention, service-assembly]
// ---
import { fork } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { childArtifacts } from "../../../../test-support/child-process.ts";
import { serviceFixture } from "../service/test-fixtures/repository.ts";
import { startService } from "../service/index.ts";
import { world, day } from "./test-fixtures/world.ts";
import { replayHost } from "./test-fixtures/host.ts";
test("SIGKILL after one committed actor prune resumes on the populated service store", async () => {
  const f = await serviceFixture();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  try {
    const commit = await f.commit(
      60,
      { comparator: "export default () => null;" },
      {
        schemas: { input: true, output: true, context: true, events: { packed: true } },
        machine: {
          initial: "counting",
          context: {},
          states: {
            counting: {
              on: { packed: "delivered" },
              meta: { gate: { comparator: "order.ts", return: "exit" } },
            },
            delivered: { type: "final" },
          },
        },
      },
    );
    await mkdir(join(f.directory, "data"));
    const path = join(f.directory, "data/state.sqlite");
    const w = await world(path);
    w.save("parcel-1");
    w.save("parcel-2");
    w.save("active", "active");
    const active = w.history.read("active")!;
    const visits = w.history.read("parcel-1")!.visits;
    w.store.writeInbox(
      { eventId: "pending", topic: "weather.station", payload: { type: "scan" } },
      ["active"],
    );
    const old = {
      source: "weather",
      eventId: "old",
      topics: ["weather.station"],
      event: { type: "scan" },
    };
    w.router.publish(old);
    w.evaluation();
    w.time(Date.now() - 5 * day);
    const inside = { ...old, eventId: "inside" };
    w.router.publish(inside);
    const keptEvaluation = w.evaluation();
    w.store.connection.database
      .prepare("UPDATE gates_evaluation SET gate=?,version=? WHERE evaluation_id=?")
      .run("blueprints/counter.yml#counting", `${commit}:blueprints/counter.yml`, keptEvaluation);
    await w.close();
    const child = fork(
      join(childArtifacts().service, "retention/test-fixtures/crash-worker.js"),
      [f.file],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    let stderr = "";
    child.stderr!.on("data", (data) => {
      stderr += String(data);
    });
    const ended = once(child, "exit");
    try {
      const [code, signal] = await ended;
      expect({ code, signal }, stderr).toEqual({ code: null, signal: "SIGKILL" });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await ended;
      }
    }
    service = await startService({
      configurationFile: f.file,
      actorHost: () => replayHost(),
      log: () => {},
    });
    expect(service.history.read("parcel-1")?.prunedAt).toBeDefined();
    expect(service.history.read("parcel-1")?.commands).toEqual([]);
    expect(service.history.read("parcel-1")?.events).toEqual([]);
    expect(service.history.read("parcel-2")?.prunedAt).toBeUndefined();
    expect(service.history.read("parcel-1")?.visits).toEqual(visits);
    expect((await service.retention.prune()).actors).toBe(1);
    const after = service.history.read("active")!;
    expect(after.visits).toEqual(active.visits);
    expect(after.commands).toEqual(active.commands);
    expect(after.events.find((e) => e.eventId === "scan-active")).toEqual(active.events[0]);
    expect(after.events.find((e) => e.eventId === "pending")?.consumedAt).toBeDefined();
    const count = (service.store.loadSnapshot("active")!.snapshot["context"] as { count: number })
      .count;
    expect(count).toBe(1);
    expect(service.router.publish(inside)).toMatchObject({ replay: true });
    expect((await service.gates!.replay(keptEvaluation)).recorded).toMatchObject({
      ok: true,
      selection: null,
    });
    expect(await service.retention.prune()).toEqual({
      actors: 0,
      inboxRows: 0,
      historyRows: 0,
      sourceEvents: 0,
      gateEvaluations: 0,
      deliveries: 0,
      redeliveries: 0,
      escalations: 0,
      notifications: 0,
      answers: 0,
      messages: 0,
      cardMoves: 0,
      createdProjects: 0,
    });
    await service.stop();
    service = undefined;
    service = await startService({
      configurationFile: f.file,
      actorHost: () => replayHost(),
      log: () => {},
    });
    expect(
      (service.store.loadSnapshot("active")!.snapshot["context"] as { count: number }).count,
    ).toBe(count);
    expect(await service.retention.prune()).toEqual({
      actors: 0,
      inboxRows: 0,
      historyRows: 0,
      sourceEvents: 0,
      gateEvaluations: 0,
      deliveries: 0,
      redeliveries: 0,
      escalations: 0,
      notifications: 0,
      answers: 0,
      messages: 0,
      cardMoves: 0,
      createdProjects: 0,
    });
  } finally {
    await service?.stop();
    await f.close();
  }
});

test.each([
  "actor-pruned",
  "escalation-pruned",
  "project-retired",
  "batch-pruned:deliveries",
  "batch-pruned:messages",
  "batch-pruned:card-moves",
])("SIGKILL at %s preserves remaining work and converges after service restart", async (target) => {
  const f = await serviceFixture();
  const { fakeServer, fixtureThread } = await import("../t3code-source/test-fixtures/server.ts");
  const { schemas } = await import("@wyrd-company/t3code-client");
  const { stringify } = await import("yaml");
  const { writeFile } = await import("node:fs/promises");
  const { remaining } = await import("./test-fixtures/remaining.ts");
  const server = await fakeServer();
  let service: Awaited<ReturnType<typeof startService>> | undefined;
  const thread = fixtureThread();
  thread.latestTurn = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...thread,
    latestTurn: {
      turnId: "read-turn",
      state: "running",
      requestedAt: thread.createdAt,
      startedAt: thread.createdAt,
      completedAt: null,
      assistantMessageId: null,
    },
  }).latestTurn;
  thread.session = schemas.orchestrationReadModel.OrchestrationThread.parse({
    ...thread,
    session: {
      threadId: thread.id,
      status: "running",
      activeTurnId: "read-turn",
      providerName: "codex",
      runtimeMode: "full-access",
      lastError: null,
      updatedAt: thread.createdAt,
    },
  }).session;
  server.baseline(thread);
  const receipts = new Map<string, number>();
  server.hooks.dispatch = (raw) => {
    const command = schemas.orchestrationCommands.ClientOrchestrationCommand.parse(raw);
    if (command.type !== "thread.turn.start") throw new Error("Unexpected fixture command");
    if (!receipts.has(command.commandId)) receipts.set(command.commandId, receipts.size + 1);
    return { sequence: receipts.get(command.commandId)! };
  };
  try {
    await writeFile(join(f.directory, "token"), "fixture-token");
    await writeFile(
      f.file,
      stringify({
        ...f.configuration,
        credentials: {
          ...f.configuration.credentials,
          writer: { kind: "t3code-token", tokenFile: "token" },
        },
        environments: { station: { url: server.url, credential: "writer" } },
      }),
    );
    const commit = await f.commit(
      60,
      { comparator: "export default () => null;" },
      {
        schemas: { input: true, output: true, context: true, events: { packed: true } },
        machine: {
          initial: "counting",
          states: {
            counting: {
              on: { packed: "delivered" },
              meta: { gate: { comparator: "order.ts", return: "exit" } },
            },
            delivered: { type: "final" },
          },
        },
      },
    );
    await mkdir(join(f.directory, "data"));
    const path = join(f.directory, "data/state.sqlite");
    const before = await remaining(path);
    const { openStore } = await import("../store/index.ts");
    const setup = openStore({ path });
    setup.connection.database
      .prepare("UPDATE gates_evaluation SET gate=?,version=? WHERE evaluation_id=?")
      .run(
        "blueprints/counter.yml#counting",
        `${commit}:blueprints/counter.yml`,
        before.evaluation,
      );
    setup.close();
    const child = fork(
      join(childArtifacts().service, "retention/test-fixtures/crash-worker.js"),
      [f.file, target],
      { stdio: ["ignore", "ignore", "pipe", "ipc"] },
    );
    let stderr = "";
    child.stderr!.on("data", (data) => {
      stderr += String(data);
    });
    const ended = once(child, "exit");
    try {
      const [code, signal] = await ended;
      expect({ code, signal }, stderr).toEqual({ code: null, signal: "SIGKILL" });
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill("SIGKILL");
        await ended;
      }
    }
    service = await startService({
      configurationFile: f.file,
      actorHost: () => ({
        ...replayHost(),
        followedThreads: () => ["conversation"],
        followers: () => ["active"],
      }),
      log: () => {},
    });
    await service.t3code.ready("station");
    await service.retention.prune();
    for (const actorId of ["parcel-1", "parcel-2"]) {
      expect(service.history.read(actorId)?.prunedAt).toBeDefined();
      expect(service.history.read(actorId)?.commands).toEqual([]);
      expect(service.history.read(actorId)?.events).toEqual([]);
    }
    expect(service.history.read("parcel-1")?.visits).toEqual(before.visits);
    for (const id of before.questions) expect(service.escalations.get(id)).toBeUndefined();
    const db = service.store.connection.database;
    expect(db.prepare("SELECT actor_id FROM github_card_move").all()).toEqual([
      { actor_id: "active" },
    ]);
    expect(db.prepare("SELECT project_id FROM t3_created_project").all()).toEqual([
      { project_id: "project" },
    ]);
    expect(service.t3code.createdProject("station", "project")?.item).toBe("alpha");
    expect(service.t3code.thread("station", "conversation")).toBeDefined();
    expect(db.prepare("SELECT delivered_to FROM agenttool_message").all()).toEqual([
      { delivered_to: "active" },
    ]);
    for (const table of ["github_delivery", "github_redelivery"])
      expect(db.prepare(`SELECT delivery_id FROM ${table}`).all()).toEqual([
        { delivery_id: "inside" },
      ]);
    expect(service.router.publish(before.inside)).toMatchObject({ replay: true });
    expect((await service.gates!.replay(before.evaluation)).recorded).toMatchObject({
      ok: true,
      selection: null,
    });
    expect(service.store.pendingInbox("active")).toEqual([]);
    expect(
      (service.store.loadSnapshot("active")!.snapshot["context"] as { count: number }).count,
    ).toBe(1);
    expect(service.history.read("active")!.commands).toEqual(before.active.commands);
    expect(service.history.read("active")!.visits).toEqual(before.active.visits);
    expect(service.escalations.get(before.open)?.status).toBe("open");
    expect(service.escalations.answer(before.open, { choice: "yes" }, "api").status).toBe(
      "answered",
    );
    expect(service.escalations.answer(before.open, { choice: "yes" }, "api").status).toBe("closed");
    await expect
      .poll(
        () =>
          db.prepare("SELECT count(*) n FROM agenttool_answer WHERE status='sent'").get()?.["n"],
      )
      .toBe(2);
    const pending = db
      .prepare("SELECT message_id FROM agenttool_answer WHERE escalation_id=?")
      .get(before.pending)!;
    for (let n = 0; n < 2; n++)
      service.agentTools!.messagePlaced({
        environment: "station",
        threadId: "conversation",
        messageId: String(pending["message_id"]),
        placement: "joined",
        turnId: "read-turn",
      });
    expect(receipts.size).toBe(2);
    const address = service.http.address();
    const call = async () => {
      const response = await fetch(`http://${address.host}:${address.port}/api/agent-tools/calls`, {
        method: "POST",
        body: JSON.stringify({
          environment: "station",
          tool: "get-messages",
          arguments: { thread: "conversation" },
          meta: {},
        }),
      });
      expect(response.status).toBe(200);
      return response.json();
    };
    const first = await call();
    expect(first).toMatchObject({ messages: [{ text: "Message" }] });
    expect(await call()).toEqual(first);
    expect(Object.values(await service.retention.prune()).every((n) => n === 0)).toBe(true);
  } finally {
    await service?.stop();
    await server.close();
    await f.close();
  }
});
