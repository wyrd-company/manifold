// ---
// relationships:
//   verifies: blueprint-migration
// ---
import { fork } from "node:child_process";
import { once } from "node:events";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { stringify } from "yaml";
import { migrationServiceFixture, changed, parcel } from "./test-fixtures/service.ts";
import type { Store } from "../store/index.ts";
import { openStore } from "../store/index.ts";
import { childArtifacts } from "../../../../test-support/child-process.ts";
// Two default-worker gates spend 10 s starting the first worker and 10 s saving.
// The 30 s limit expires while the restart binds its revision, before it is ready.
test("SIGKILL after a migration commit restores the target once and takes the next event", async () => {
  const waiting = {
    type: "parallel",
    states: {
      timer: {
        initial: "armed",
        states: { armed: { after: { 10000: "elapsed" } }, elapsed: { type: "final" } },
      },
      delivery: {
        initial: "pending",
        states: {
          pending: { on: { "github.issue.closed": "received" } },
          received: { type: "final" },
        },
      },
    },
    onDone: "delivered",
  };
  const original = {
    ...parcel,
    machine: { ...parcel.machine, states: { waiting, delivered: { type: "final" } } },
    schemas: { ...parcel.schemas, events: { "github.issue.closed": true } },
  };
  const target = {
    ...changed,
    machine: original.machine,
    schemas: { ...changed.schemas, events: original.schemas.events },
  };
  const f = await migrationServiceFixture(original);
  const children: ReturnType<typeof fork>[] = [];
  let store: Store | undefined;
  const logs: { event: string }[] = [];
  async function start(mode: string) {
    const child = fork(
      join(childArtifacts().service, "migrations/test-fixtures/crash-worker.js"),
      [f.file, mode],
      { silent: true, execArgv: [] },
    );
    children.push(child);
    let stderr = "";
    child.stderr!.on("data", (chunk) => {
      stderr += String(chunk);
    });
    const exited = once(child, "exit");
    const address = await new Promise<{ host: string; port: number }>((resolve, reject) => {
      child.on(
        "message",
        (message: {
          type: string;
          address: { host: string; port: number };
          entry: { event: string };
        }) => {
          if (message.type === "ready") resolve(message.address);
          if (message.type === "log") logs.push(message.entry);
        },
      );
      child.once("exit", () => reject(new Error(stderr)));
    });
    return { child, exited, url: `http://${address.host}:${address.port}` };
  }
  try {
    const first = await start("kill");
    store = openStore({ path: join(f.directory, "data/state.sqlite") });
    await expect
      .poll(() => store!.loadSnapshot("task:I_A")?.snapshot.value)
      .toEqual({ waiting: { timer: "armed", delivery: "pending" } });
    const before = store!.loadSnapshot("task:I_A")!;
    const deadline = store!.connection.database
      .prepare("SELECT * FROM store_deadline WHERE actor_id=?")
      .get("task:I_A")!;
    const response = await fetch(first.url + "/api/blueprints/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: "blueprints/parcel.yml",
        base: f.commit,
        text: stringify(target),
        message: "Split parcel depot",
        saveId: "a".repeat(32),
      }),
    }).catch(() => undefined);
    if (response) expect(response.status).toBe(200);
    expect(await first.exited).toEqual([null, "SIGKILL"]);
    const committed = store!.loadSnapshot("task:I_A")!;
    expect(committed.machine).not.toBe(before.machine);
    expect(committed.snapshot).toMatchObject({
      value: before.snapshot.status === "active" ? before.snapshot.value : "",
      context: { zone: "north" },
      entries: before.snapshot["entries"],
    });
    expect(
      store!.connection.database
        .prepare("SELECT * FROM store_deadline WHERE actor_id=?")
        .get("task:I_A"),
    ).toEqual(deadline);
    logs.length = 0;
    const resumed = await start("resume");
    expect(store!.loadSnapshot("task:I_A")!.machine).toBe(committed.machine);
    expect(logs.filter((entry) => entry.event === "actor-migrated")).toEqual([]);
    // The restarted router accepts the target's subscription through a real webhook-backed issue topic.
    f.api.issues.get("I_A")!.state = "CLOSED";
    const event = (await import("../github-source/test-fixtures/api.ts")).signedDelivery(
      "issues",
      {
        action: "closed",
        issue: { node_id: "I_A", number: 1 },
        repository: { full_name: "sample/records" },
        changes: { title: { from: "Old label" } },
      },
      "closed-one",
    );
    expect(
      (
        await fetch(resumed.url + "/webhooks/github", {
          method: "POST",
          headers: event.headers,
          body: event.body,
        })
      ).status,
    ).toBe(202);
    await expect
      .poll(
        () =>
          store!.connection.database
            .prepare(
              "SELECT count(*) AS count FROM store_inbox WHERE actor_id=? AND consumed_at IS NOT NULL",
            )
            .get("task:I_A")!["count"],
      )
      .toBeGreaterThan(0);
    resumed.child.send({ type: "advance", elapsed: 10000 });
    await expect
      .poll(() => store!.loadSnapshot("task:I_A")!.snapshot.status, { timeout: 20000 })
      .toBe("done");
    const fired = store!.connection.database
      .prepare("SELECT * FROM store_inbox WHERE actor_id=? AND topic LIKE 'deadline.%'")
      .all("task:I_A");
    expect(fired).toHaveLength(1);
    expect(Number(fired[0]!["consumed_at"])).toBeGreaterThanOrEqual(Number(deadline["fire_at"]));
    expect(logs.filter((entry) => entry.event === "actor-migrated")).toEqual([]);
    resumed.child.send({ type: "stop" });
    expect(await resumed.exited).toEqual([0, null]);
  } finally {
    for (const child of children)
      if (child.exitCode === null && child.signalCode === null) {
        const exited = once(child, "exit");
        child.kill("SIGKILL");
        await exited;
      }
    store?.close();
    await f.close();
  }
}, 60_000);
