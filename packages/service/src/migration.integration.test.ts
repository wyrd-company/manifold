// ---
// relationships:
//   verifies: [blueprint-migration, service-assembly]
// ---
import { expect, test } from "vite-plus/test";
import { stringify } from "yaml";
import { startService } from "./service/index.ts";
import { migrationServiceFixture, changed } from "./migrations/test-fixtures/service.ts";
test("intake starts a parcel actor and a blueprint API save migrates its waiting context", async () => {
  const fixture = await migrationServiceFixture();
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  try {
    await expect.poll(() => service.store.loadSnapshot("task:I_A")?.snapshot.value).toBe("waiting");
    const previous = service.store.loadSnapshot("task:I_A")!;
    const address = service.http.address();
    const response = await fetch(`http://${address.host}:${address.port}/api/blueprints/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "blueprints/parcel.yml",
        base: fixture.commit,
        text: stringify(changed),
        message: "Split parcel depot",
        saveId: "a".repeat(32),
      }),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    await expect
      .poll(() => service.store.loadSnapshot("task:I_A")!.machine)
      .not.toBe(previous.machine);
    const migrated = service.store.loadSnapshot("task:I_A")!;
    expect(migrated.snapshot).toMatchObject({
      value: "waiting",
      context: { zone: "north" },
      entries: previous.snapshot["entries"],
    });
    expect((migrated.snapshot["context"] as Record<string, unknown>)["manifold"]).toEqual(
      (previous.snapshot["context"] as Record<string, unknown>)["manifold"],
    );
    // Structural history seam: the rebase replaces this stored version assertion with ActorHistory.
    expect(migrated.machine).toBe(`${service.revisions.latest()!.commit}:blueprints/parcel.yml`);
    service.router.publish({
      source: "github",
      eventId: "scanned-one",
      topics: ["github.issue.I_A"],
      event: { type: "scanned" },
    });
    await expect.poll(() => service.store.loadSnapshot("task:I_A")!.snapshot.status).toBe("done");
  } finally {
    await service.stop();
    await fixture.close();
  }
});
test("a holder keeps its token, gate entry and reservation through the assembled migration save", async () => {
  const gate = {
    token: "token.granted",
    comparator: "comparators/estimate.ts",
    return: { state: "delivered" },
    reservation: true,
  };
  const original = {
    ...changed,
    migrations: [],
    schemas: {
      ...changed.schemas,
      context: { type: "object", required: ["depot"], properties: { depot: { type: "string" } } },
      events: { scanned: true, "token.granted": true },
    },
    machine: {
      id: "parcel",
      initial: "queued",
      context: { depot: "north" },
      states: {
        queued: { meta: { gate }, on: { "token.granted": "waiting" } },
        waiting: { on: { scanned: "delivered" } },
        delivered: { type: "final" },
      },
    },
  };
  const f = await migrationServiceFixture(original);
  const logs: unknown[] = [];
  const service = await startService({
    configurationFile: f.file,
    log: (entry) => logs.push(entry),
  });
  try {
    try {
      await expect
        .poll(() => service.store.loadSnapshot("task:I_A")?.snapshot.value, { timeout: 15000 })
        .toBe("waiting");
    } catch (error) {
      throw new Error(
        JSON.stringify({
          logs,
          gates: service.store.connection.database.prepare("SELECT * FROM gates_evaluation").all(),
          ledger: service.store.connection.database.prepare("SELECT * FROM ledger_entries").all(),
        }),
        { cause: error },
      );
    }
    const db = service.store.connection.database;
    const tokens = db.prepare("SELECT * FROM gates_token WHERE actor_id=?").all("task:I_A");
    const entries = db.prepare("SELECT * FROM gates_entry WHERE actor_id=?").all("task:I_A");
    const reservations = db.prepare("SELECT * FROM ledger_entries ORDER BY seq").all();
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!["returned_at"]).toBeNull();
    expect(
      reservations.some((row) => row["kind"] === "reserve" && row["actor"] === "task:I_A"),
    ).toBe(true);
    const document = {
      ...changed,
      machine: {
        ...original.machine,
        states: { ...original.machine.states, waiting: changed.machine.states.waiting },
      },
      schemas: { ...changed.schemas, events: original.schemas.events },
    };
    const saved = await service.revisions.save({
      path: "blueprints/parcel.yml",
      base: f.commit,
      text: stringify(document),
      message: "Split parcel depot",
      saveId: "b".repeat(32),
    });
    if (saved.outcome === "conflict") throw new Error("Unexpected conflict");
    await service.migrations.pass();
    expect(service.store.loadSnapshot("task:I_A")!.machine).toBe(
      `${saved.commit}:blueprints/parcel.yml`,
    );
    expect(db.prepare("SELECT * FROM gates_token WHERE actor_id=?").all("task:I_A")).toEqual(
      tokens,
    );
    expect(db.prepare("SELECT * FROM gates_entry WHERE actor_id=?").all("task:I_A")).toEqual(
      entries,
    );
    expect(db.prepare("SELECT * FROM ledger_entries ORDER BY seq").all()).toEqual(reservations);
  } finally {
    await service.stop();
    await f.close();
  }
});
