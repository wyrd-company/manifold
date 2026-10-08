// ---
// relationships:
//   verifies: [retention, actor-history]
// ---
import { test } from "vite-plus/test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
import { openStore } from "../store/index.ts";
import { openHistory } from "../history/index.ts";
import { routerSteps } from "../router/migrations.ts";
import { gatesMigrationSteps } from "../gates/index.ts";
import { openRetention } from "../retention/index.ts";

test("UAT seed preserves existing rows and one prune run removes exactly expired rows", async () => {
  const directory = await mkdtemp(join(tmpdir(), "uat-retention-"));
  const path = join(directory, "store.sqlite");
  const now = Date.parse("2026-01-01T00:00:00Z");
  let store: ReturnType<typeof openStore> | undefined;
  try {
    store = openStore({ path });
    openHistory({ store, log: () => {} });
    store.connection.migrate("router", routerSteps);
    store.connection.migrate("gates", gatesMigrationSteps);
    store.saveSnapshot({
      actorId: "existing",
      machine: "sample",
      snapshot: { status: "active", value: "waiting" },
    });
    const existing = store.loadSnapshot("existing");
    store.close();
    store = undefined;
    const args = [
      new URL("../../../../testing/uat/seed-retention.mjs", import.meta.url).pathname,
      "--store",
      path,
      "--service-stopped",
      "--now",
      new Date(now).toISOString(),
    ];
    await assert.rejects(
      execute(
        process.execPath,
        args.filter((arg) => arg !== "--service-stopped"),
      ),
      /Usage:/,
    );
    const first = JSON.parse((await execute(process.execPath, args)).stdout);
    assert.deepEqual(JSON.parse((await execute(process.execPath, args)).stdout), first);
    store = openStore({ path });
    const history = openHistory({ store, log: () => {} });
    const recent = history.read("uat-retention-recent");
    const expired = history.read("uat-retention-expired");
    assert.equal(expired!.events.length, 1);
    assert.equal(expired!.commands.length, 1);
    const retention = openRetention({
      store,
      history,
      escalations: { list: () => [] },
      configuration: { historyDays: 90, sourceEventDays: { default: 30 }, gateEvaluationDays: 30 },
      clock: { now: () => now, setTimer: () => () => {}, yield: (next) => setImmediate(next) },
      log: () => {},
    });
    assert.deepEqual(await retention.prune(), {
      actors: 1,
      inboxRows: 1,
      historyRows: 2,
      sourceEvents: 1,
      gateEvaluations: 1,
    });
    assert.deepEqual(store.loadSnapshot("existing"), existing);
    assert.deepEqual(history.read("uat-retention-recent"), recent);
    assert.deepEqual(history.read("uat-retention-expired")!.visits, expired!.visits);
    assert.deepEqual(history.read("uat-retention-expired")!.events, []);
    assert.deepEqual(history.read("uat-retention-expired")!.commands, []);
    assert.equal(
      store.connection.database
        .prepare("SELECT count(*) AS n FROM router_source_event WHERE source='uat-retention'")
        .get()!["n"],
      1,
    );
    assert.equal(
      store.connection.database
        .prepare("SELECT count(*) AS n FROM gates_evaluation WHERE gate='uat-retention#waiting'")
        .get()!["n"],
      1,
    );
    assert.deepEqual(await retention.prune(), {
      actors: 0,
      inboxRows: 0,
      historyRows: 0,
      sourceEvents: 0,
      gateEvaluations: 0,
    });
    await retention.stop();
  } finally {
    store?.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("UAT seed refuses an uninitialized store without changing its schema", async () => {
  const directory = await mkdtemp(join(tmpdir(), "uat-uninitialized-"));
  const path = join(directory, "store.sqlite");
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(path);
  try {
    database.exec("CREATE TABLE sample (value TEXT); INSERT INTO sample VALUES ('kept')");
    const before = database.prepare("SELECT * FROM sqlite_schema").all();
    await assert.rejects(
      execute(process.execPath, [
        new URL("../../../../testing/uat/seed-retention.mjs", import.meta.url).pathname,
        "--store",
        path,
        "--service-stopped",
      ]),
      /Initialize this store/,
    );
    assert.deepEqual(database.prepare("SELECT * FROM sqlite_schema").all(), before);
    assert.deepEqual(
      database
        .prepare("SELECT * FROM sample")
        .all()
        .map((row) => row["value"]),
      ["kept"],
    );
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
