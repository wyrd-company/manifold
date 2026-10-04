// ---
// relationships:
//   verifies: router-events
// ---
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import { parse } from "yaml";
import { expect, test } from "vite-plus/test";
import { openStore } from "../store/index.ts";
import { startRouter, type SourceEvent } from "./index.ts";
const schema = parse(
  readFileSync(
    new URL("../../../../docs/specifications/router-events.schema.yml", import.meta.url),
    "utf8",
  ),
) as object;
const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(schema);
const sourceSchema = ajv.getSchema(
  "https://manifold.wyrd.company/schemas/router-events#/$defs/source-event",
)!;
const outcomeSchema = ajv.getSchema(
  "https://manifold.wyrd.company/schemas/router-events#/$defs/publish-outcome",
)!;
const sample = () => ({
  source: "weather",
  eventId: "reading",
  topics: ["weather.station"],
  event: { type: "reading", amount: 1 },
});
const invalid: [string, unknown][] = [
  ["/topics", { ...sample(), topics: "weather.station" }],
  ["/event", { ...sample(), event: null }],
  ["/event", { ...sample(), event: [] }],
  ["/eventId", { ...sample(), eventId: 1 }],
  ["/event/type", { ...sample(), event: { type: 1 } }],

  ["/source", { ...sample(), source: "weather\n" }],
  ["/topics/0", { ...sample(), topics: ["weather.station\n"] }],
  ["", null],
  ["", []],
  ["/source", { ...sample(), source: "" }],
  ["/source", { ...sample(), source: "deadline" }],
  ["/source", { ...sample(), source: "Weather" }],
  ["/source", { ...sample(), source: "a".repeat(64) }],
  ["/eventId", { ...sample(), eventId: "" }],
  ["/eventId", { ...sample(), eventId: "\u0000abc" }],
  ["/eventId", { ...sample(), eventId: "abc\u0000" }],
  ["/eventId", { ...sample(), eventId: "\ud800" }],
  ["/eventId", { ...sample(), eventId: "\ud801" }],
  ["/eventId", { ...sample(), eventId: "\udc00" }],
  ["/topics", { ...sample(), topics: [] }],
  ["/topics", { ...sample(), topics: ["weather", "weather"] }],
  ["/topics/0", { ...sample(), topics: ["weather..station"] }],
  ["/topics/0", { ...sample(), topics: ["weather.a b"] }],
  ["/topics/0", { ...sample(), topics: ["weather.a\u007f"] }],
  ["/event/type", { ...sample(), event: { type: "" } }],
  ["/event/type", { ...sample(), event: { type: "xstate.done" } }],
  ["/event/type", { ...sample(), event: {} }],
  ["/extra", { ...sample(), extra: true }],
  ["/source", { eventId: "a", topics: ["weather"], event: { type: "reading" } }],
];
for (const [expectedPath, fixture] of invalid)
  test(`rejects ${expectedPath}: ${JSON.stringify(fixture)}`, () => {
    const store = openStore({ path: ":memory:" });
    const router = startRouter({
      store,
      host: {
        subscription: () => ({ topics: [] }),
        restore: () => ({ status: "held", reason: "unavailable" }),
      },
    });
    try {
      expect(sourceSchema(fixture)).toBe(false);
      const result = router.publish(fixture as SourceEvent);
      expect(result.status).toBe("rejected");
      if (result.status !== "rejected") throw new Error("Expected rejection");
      expect(result.issues.map((issue) => issue.path)).toContain(expectedPath);
      const schemaPaths = (sourceSchema.errors ?? [])
        .filter((error) => !["not", "if"].includes(error.keyword))
        .map((error) => {
          const property = error.params["missingProperty"] ?? error.params["additionalProperty"];
          return property ? `${error.instancePath}/${String(property)}` : error.instancePath;
        });
      for (const path of schemaPaths)
        expect(result.issues.map((issue) => issue.path)).toContain(path);
      expect(outcomeSchema(result)).toBe(true);
      expect(store.connection.database.prepare("SELECT * FROM router_source_event").all()).toEqual(
        [],
      );
    } finally {
      router.stop();
      store.close();
    }
  });

test("rejects non-JSON values, cycles and wrong topic source without writes and reports every failure", () => {
  const store = openStore({ path: ":memory:" });
  const router = startRouter({
    store,
    host: {
      subscription: () => ({ topics: [] }),
      restore: () => ({ status: "held", reason: "unavailable" }),
    },
  });
  try {
    const cycle: Record<string, unknown> = {};
    cycle["self"] = cycle;
    for (const value of [
      undefined,
      NaN,
      Infinity,
      1n,
      () => {},
      Symbol("value"),
      new Date(),
      cycle,
      [undefined],
    ]) {
      const result = router.publish({
        ...sample(),
        topics: ["sensor.station"],
        event: { type: "reading", "a/b~c": value },
      } as SourceEvent);
      expect(result.status).toBe("rejected");
      if (result.status !== "rejected") throw new Error("Expected rejection");
      expect(result.issues.map((issue) => issue.path)).toContain("/topics/0");
      expect(result.issues.some((issue) => issue.path.startsWith("/event/a~1b~0c"))).toBe(true);
    }
    expect(store.connection.database.prepare("SELECT * FROM router_source_event").all()).toEqual(
      [],
    );
  } finally {
    router.stop();
    store.close();
  }
});

test("accepted Unicode ids remain distinct after reopen and every outcome agrees with the schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "router-ids-"));
  const path = join(dir, "data.sqlite");
  let store = openStore({ path });
  const host = {
    subscription: () => ({ topics: ["weather"] }),
    restore: () => ({ status: "held" as const, reason: "unavailable" }),
  };
  store.saveSnapshot({
    actorId: "counter",
    machine: "counter",
    snapshot: { status: "active", value: "idle" },
  });
  let router = startRouter({ store, host });
  const ids = ["\n", "a\nb", "😀", "�", "é", "é", ":", " ", "\u0001", "\u007f"];
  try {
    for (const eventId of ids) {
      const fixture = { ...sample(), eventId, event: { type: "reading.with.dots", amount: 2 } };
      expect(sourceSchema(fixture)).toBe(true);
      const result = router.publish(fixture);
      expect(result).toMatchObject({ status: "accepted", replay: false });
      expect(outcomeSchema(JSON.parse(JSON.stringify(result)))).toBe(true);
    }
    router.stop();
    store.close();
    store = openStore({ path });
    router = startRouter({ store, host });
    expect(store.pendingInbox("counter").map((row) => row.eventId)).toEqual(
      ids.map((id) => `weather:${id}`),
    );
    for (const eventId of ids)
      expect(router.publish({ ...sample(), eventId })).toEqual({
        status: "accepted",
        replay: true,
        rows: [],
      });
  } finally {
    router.stop();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
