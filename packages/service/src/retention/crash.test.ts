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
    });
  } finally {
    await service?.stop();
    await f.close();
  }
});
