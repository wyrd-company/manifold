// ---
// relationships:
//   verifies: [blueprint-migration, service-assembly]
// ---
import { expect, test } from "vite-plus/test";
import { stringify } from "yaml";
import { startService } from "./service/index.ts";
import { migrationServiceFixture, changed, parcel } from "./migrations/test-fixtures/service.ts";
test("intake starts a parcel actor and a blueprint API save migrates its waiting context", async () => {
  const invoke = {
    id: "question",
    src: "escalate",
    input: {
      question: "Which depot receives the parcel?",
      choices: [{ id: "north", label: "North" }],
    },
  };
  const actors = { escalate: { input: true, output: true } };
  const original = {
    ...parcel,
    schemas: { ...parcel.schemas, actors },
    machine: {
      ...parcel.machine,
      states: { ...parcel.machine.states, waiting: { ...parcel.machine.states.waiting, invoke } },
    },
  };
  const target = {
    ...changed,
    schemas: { ...changed.schemas, actors },
    machine: {
      ...changed.machine,
      states: { ...changed.machine.states, waiting: { ...changed.machine.states.waiting, invoke } },
    },
  };
  const fixture = await migrationServiceFixture(original);
  const service = await startService({ configurationFile: fixture.file, log: () => {} });
  try {
    await expect.poll(() => service.store.loadSnapshot("task:I_A")?.snapshot.value).toBe("waiting");
    const previous = service.store.loadSnapshot("task:I_A")!;
    const previousVisit = service.history.read("task:I_A")!.visits.at(-1)!;
    const question = service.escalations.list({ status: "open" });
    expect(question).toHaveLength(1);
    const address = service.http.address();
    const response = await fetch(`http://${address.host}:${address.port}/api/blueprints/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "blueprints/parcel.yml",
        base: fixture.commit,
        text: stringify(target),
        message: "Split parcel depot",
        saveId: "a".repeat(32),
      }),
    });
    expect(response.status, await response.clone().text()).toBe(200);
    await expect
      .poll(() => service.store.loadSnapshot("task:I_A")!.machine, { timeout: 15000 })
      .not.toBe(previous.machine);
    const migrated = service.store.loadSnapshot("task:I_A")!;
    expect(service.escalations.list({ status: "open" })).toEqual(question);
    expect(migrated.snapshot).toMatchObject({
      value: "waiting",
      context: { zone: "north" },
      entries: previous.snapshot["entries"],
    });
    expect((migrated.snapshot["context"] as Record<string, unknown>)["manifold"]).toEqual(
      (previous.snapshot["context"] as Record<string, unknown>)["manifold"],
    );
    const targetMachine = `${service.revisions.latest()!.commit}:blueprints/parcel.yml`;
    expect(migrated.machine).toBe(targetMachine);
    expect(service.actorHost.subscription(migrated)).toEqual(
      service.actorHost.subscription(previous),
    );
    const visits = service.history.read("task:I_A")!.visits;
    expect(visits).toHaveLength(2);
    expect(visits[0]).toEqual({ ...previousVisit, exitedAt: visits[1]!.enteredAt });
    expect(visits[0]).not.toHaveProperty("exitEvent");
    expect(visits[1]).toMatchObject({
      visit: previousVisit.visit + 1,
      value: "waiting",
      machine: targetMachine,
      blueprint: { path: "blueprints/parcel.yml", commit: service.revisions.latest()!.commit },
    });
    expect(visits[1]).not.toHaveProperty("exitedAt");
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
}, 60000);
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
    const previousVisit = service.history.read("task:I_A")!.visits.at(-1)!;
    expect(previousVisit.value).toBe("waiting");
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
      base: f.commit,
      message: "Split parcel depot",
      saveId: "b".repeat(32),
      files: [{ path: "blueprints/parcel.yml", text: stringify(document) }],
    });
    if (saved.outcome === "conflict") throw new Error("Unexpected conflict");
    await service.migrations.run();
    await expect
      .poll(() => service.store.loadSnapshot("task:I_A")!.machine, { timeout: 15000 })
      .toBe(`${saved.commit}:blueprints/parcel.yml`);
    const visits = service.history.read("task:I_A")!.visits;
    expect(visits.at(-2)).toEqual({ ...previousVisit, exitedAt: visits.at(-1)!.enteredAt });
    expect(visits.at(-2)).not.toHaveProperty("exitEvent");
    expect(visits.at(-1)).toMatchObject({
      visit: previousVisit.visit + 1,
      value: "waiting",
      machine: `${saved.commit}:blueprints/parcel.yml`,
    });
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
