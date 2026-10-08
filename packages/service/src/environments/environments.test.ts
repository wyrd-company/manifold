// ---
// relationships:
//   verifies: [environment-control, environments-api, environment-events]
// ---
import { readFileSync } from "node:fs";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { startRouter } from "../router/index.ts";
import type { SourceEvent } from "../router/index.ts";
import { createHttpHost } from "../http-host/index.ts";
import { openEnvironments } from "./index.ts";
import type { EnvironmentStatus } from "../t3code-source/index.ts";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanups.splice(0).toReversed()) close();
});
function setup() {
  const store = openStore({ path: ":memory:" });
  cleanups.push(() => store.close());
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: () => ({ status: "held", reason: "fixture" }),
    },
  });
  cleanups.push(() => router.stop());
  const configuration = Object.fromEntries(
    ["station", "depot"].map((name) => [
      name,
      {
        url: "http://127.0.0.1:3773",
        credential: "writer",
        reconnect: { initialMs: 1, factor: 2, maxMs: 5, jitter: 0 },
        heartbeat: { intervalMs: 5000, missedPongLimit: 3 },
        openTimeoutMs: 10000,
      },
    ]),
  );
  let statuses: EnvironmentStatus[] = [];
  const restart = vi.fn();
  const options = {
    store,
    router,
    environments: configuration,
    configurationFile: "/example/service.yml",
    status: () => statuses,
    restart,
    scheduled: () => 2,
    clock: () => 1000,
  };
  const module = openEnvironments(options);
  return {
    module,
    options,
    store,
    router,
    restart,
    status: (value: EnvironmentStatus[]) => {
      statuses = value;
    },
  };
}
test("each hold action converges, persists, publishes one sequenced event and restores", () => {
  const f = setup();
  const publish = vi.spyOn(f.router, "publish");
  const validateEvent = new Ajv2020({ strict: false, validateFormats: false }).compile(
    parse(
      readFileSync(
        new URL("../../../../docs/specifications/environment-events.schema.yml", import.meta.url),
        "utf8",
      ),
    ),
  );
  expect(f.module.held("station")).toEqual({ paused: false, disconnected: false, sequence: 0 });
  for (const [action, paused, disconnected, type, sequence] of [
    ["pause", true, false, "environment.paused", 1],
    ["disconnect", true, true, "environment.disconnected", 2],
    ["resume", false, true, "environment.resumed", 3],
    ["reconnect", false, false, "environment.reconnected", 4],
  ] as const) {
    expect(f.module.act("station", action)).toEqual({ paused, disconnected, sequence });
    expect(f.module.act("station", action)).toEqual({ paused, disconnected, sequence });
    expect(publish).toHaveBeenLastCalledWith({
      source: "environment",
      eventId: `station/${sequence}`,
      topics: ["environment.station"],
      event: { type, environment: "station", at: "1970-01-01T00:00:01.000Z" },
    });
    expect(publish).toHaveBeenCalledTimes(sequence);
    expect(validateEvent(publish.mock.calls.at(-1)![0].event)).toBe(true);
    expect(openEnvironments(f.options).held("station")).toEqual(f.module.held("station"));
    expect(f.module.held("depot").sequence).toBe(0);
  }
});
test("a router rejection rolls back the hold and sequence and wakes nobody", async () => {
  const f = setup();
  vi.spyOn(f.router, "publish").mockImplementation((_event: SourceEvent) => ({
    status: "rejected",
    issues: [{ path: "", message: "fixture" }],
  }));
  const controller = new AbortController();
  let woke = false;
  const wait = f.module.changed("station", 0, controller.signal).then(
    () => {
      woke = true;
    },
    () => {},
  );
  expect(() => f.module.act("station", "pause")).toThrow();
  expect(f.module.held("station").sequence).toBe(0);
  expect(f.store.connection.database.prepare("SELECT * FROM environment_hold").all()).toEqual([]);
  await Promise.resolve();
  expect(woke).toBe(false);
  controller.abort();
  await wait;
});
test("changed is level triggered, isolated, and abortable", async () => {
  const f = setup();
  const controller = new AbortController();
  const wait = f.module.changed("station", 0, controller.signal);
  f.module.act("depot", "pause");
  f.module.act("station", "pause");
  await wait;
  await f.module.changed("station", 0, controller.signal);
  const cancelled = f.module.changed("station", 1, controller.signal);
  controller.abort(new Error("cancelled"));
  await expect(cancelled).rejects.toThrow("cancelled");
  await expect(f.module.changed("station", 1, controller.signal)).rejects.toThrow("cancelled");
});
test("reconnect restarts a stopped source even without a hold change", () => {
  const f = setup();
  f.status([
    {
      environment: "station",
      state: "stopped",
      error: "fixture",
      followedThreads: 0,
      openSubscriptions: 0,
      activeThreads: 0,
    },
  ]);
  f.module.act("station", "reconnect");
  expect(f.restart).toHaveBeenCalledWith("station");
  expect(f.module.held("station").sequence).toBe(0);
});

test.each([false, true])("actions preserve the other hold when initially paused=%s", (paused) => {
  for (const disconnected of [false, true])
    for (const action of ["pause", "resume", "disconnect", "reconnect"] as const) {
      const f = setup();
      if (paused) f.module.act("station", "pause");
      if (disconnected) f.module.act("station", "disconnect");
      const current = f.module.held("station");
      const next = f.module.act("station", action);
      expect(next.paused).toBe(action === "pause" ? true : action === "resume" ? false : paused);
      expect(next.disconnected).toBe(
        action === "disconnect" ? true : action === "reconnect" ? false : disconnected,
      );
      expect(next.sequence).toBe(
        current.sequence +
          Number(next.paused !== current.paused || next.disconnected !== current.disconnected),
      );
    }
});

test("summary precedence follows every source state and hold pair; failed action changes nothing", async () => {
  const f = setup();
  const http = createHttpHost({ configuration: { host: "127.0.0.1", port: 0 }, onError: () => {} });
  http.mount("/api/environments", f.module.requestListener);
  const address = await http.listen();
  const base = `http://${address.host}:${address.port}/api/environments`;
  try {
    for (const state of ["connecting", "following", "retrying", "stopped", "disconnected"] as const)
      for (const paused of [false, true])
        for (const disconnected of [false, true]) {
          f.status([
            {
              environment: "station",
              state,
              error: "sample error",
              followedThreads: 3,
              activeThreads: 2,
              openSubscriptions: 1,
            },
          ]);
          f.module.act("station", paused ? "pause" : "resume");
          // Set holds before restoring the stopped status: reconnect deliberately restarts it.
          f.module.act("station", disconnected ? "disconnect" : "reconnect");
          const response = await fetch(base + "?ignored=true");
          const summary = (await response.json()).environments[0];
          const connection =
            disconnected || state === "stopped"
              ? "disconnected"
              : state === "following"
                ? "connected"
                : "connecting";
          expect(summary).toMatchObject({
            connection,
            status: connection === "disconnected" ? connection : paused ? "paused" : connection,
            paused,
            disconnected,
            activeThreads: connection === "connected" ? 2 : null,
            scheduledThreads: 2,
            error: "sample error",
          });
        }
    f.module.act("station", "resume");
    const before = f.module.held("station");
    vi.spyOn(f.router, "publish").mockReturnValue({ status: "rejected", issues: [] });
    const failed = await fetch(base + "/station/pause", { method: "POST" });
    expect(failed.status).toBe(500);
    expect(await failed.json()).toMatchObject({ error: { kind: "action-failed" } });
    expect(f.module.held("station")).toEqual(before);
  } finally {
    await http.close();
  }
});

test("environment migration matches its SQL contract and rejects invalid durable holds", () => {
  const f = setup();
  f.module.act("station", "pause");
  const db = f.store.connection.database;
  const expected = readFileSync(
    new URL(
      "../../../../docs/specifications/environment-control-database-schema.sql",
      import.meta.url,
    ),
    "utf8",
  )
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n")
    .trim()
    .replace(/;$/, "")
    .replace(/\s+/g, " ");
  const actual = String(
    db.prepare("SELECT sql FROM sqlite_master WHERE name='environment_hold'").get()!["sql"],
  ).replace(/\s+/g, " ");
  expect(actual).toBe(expected);
  expect(
    db.prepare("SELECT version FROM schema_migration WHERE owner='environment'").get()!["version"],
  ).toBe(1);
  for (const [paused, disconnected, sequence] of [
    [2, 0, 1],
    [0, 2, 1],
    [0, 0, 0],
    [0, 0, -1],
  ])
    expect(() =>
      db
        .prepare("INSERT INTO environment_hold VALUES(?,?,?,?,?)")
        .run("depot", paused!, disconnected!, sequence!, 1000),
    ).toThrow();
  expect(f.module.held("station")).toEqual({ paused: true, disconnected: false, sequence: 1 });
});
