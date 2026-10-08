// ---
// relationships:
//   verifies: [retention, actor-history]
// ---
// Run from a source checkout with dependencies installed and the shared package built.
// The operator must stop the service before running this development/UAT tool.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { openStore } from "../../packages/service/src/store/index.ts";
import { openHistory } from "../../packages/service/src/history/index.ts";

const help = `Usage: node testing/uat/seed-retention.mjs --store <existing-store.sqlite> --service-stopped
  [--now <ISO timestamp>] [--history-days <days>] [--source-days <days>] [--gate-days <days>]
Stop the service first. Defaults: history 90 days; source events and gate evaluations 30 days.
Use the install's configured retention windows. All generated identifiers begin with uat-retention.
Adds expired and recent ended actors, consumed inbox/history rows, source events, and gate evaluations.
Preserves existing data. Repeat with the same arguments to make no further changes.
Do not use on a production store. The store must already have been initialized by the service.`;
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(help);
  process.exit(0);
}
const values = new Map();
let stopped = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--service-stopped") {
    stopped = true;
    continue;
  }
  if (
    !["--store", "--now", "--history-days", "--source-days", "--gate-days"].includes(args[i]) ||
    !args[i + 1]
  )
    throw new Error(help);
  if (values.has(args[i])) throw new Error("Duplicate argument");
  values.set(args[i], args[++i]);
}
if (!stopped || !values.has("--store")) throw new Error(help);
const path = resolve(values.get("--store"));
if (!existsSync(path))
  throw new Error("Initialize this store by starting and stopping the service first.");
const now = values.has("--now") ? Date.parse(values.get("--now")) : Date.now();
if (!Number.isFinite(now)) throw new Error("Invalid --now timestamp");
const days = (name, fallback) => {
  const value = Number(values.get(name) ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive whole number`);
  return value;
};
const day = 86400000;
const windows = {
  history: days("--history-days", 90),
  source: days("--source-days", 30),
  gates: days("--gate-days", 30),
};
const store = openStore({ path });
try {
  for (const table of [
    "history_visit",
    "history_command",
    "router_source_event",
    "gates_evaluation",
  ])
    if (
      !store.connection.database.prepare("SELECT name FROM sqlite_schema WHERE name=?").get(table)
    )
      throw new Error("Initialize this store by starting and stopping the service first.");
  const marker = "uat-retention";
  const existing = store.loadSnapshot(`${marker}-expired`);
  if (existing) {
    if (existing.machine !== marker)
      throw new Error("UAT identifier collision; no rows were added.");
  } else
    store.connection.transaction(() => {
      for (const kind of ["expired", "recent"]) {
        const actorId = `${marker}-${kind}`;
        if (store.loadSnapshot(actorId))
          throw new Error("UAT identifier collision; no rows were added.");
        const at = kind === "expired" ? now - (windows.history + 1) * day : now;
        const actorHistory = openHistory({ store, now: () => at, log: () => {} });
        const write = {
          actorId,
          machine: marker,
          snapshot: { status: "active", value: "waiting" },
          activeInvokes: [],
          entered: [],
          entries: {},
        };
        store.saveSnapshot(write);
        actorHistory.saveHook(write);
        const eventId = `${actorId}-scan`;
        store.writeInbox(
          { eventId, topic: "uat-retention.station", payload: { type: "scan", reading: 42 } },
          [actorId],
        );
        store.markConsumed(actorId, eventId);
        actorHistory.saveHook({ ...write, eventId, changedBy: { type: "scan", eventId } });
        actorHistory.commandSending({
          implementation: "turn-start",
          commandId: `${actorId}-command`,
          invocation: { actorId, invokeId: "send", entryId: "1" },
          environment: "example-environment",
          threadId: `${actorId}-thread`,
          messageId: `${actorId}-message`,
        });
        const ended = {
          ...write,
          snapshot: { status: "done", value: "delivered", output: { outcome: "received" } },
        };
        store.saveSnapshot(ended);
        actorHistory.saveHook(ended);
        // The store uses the real clock; only these synthetic actors receive backdated ends.
        store.connection.database
          .prepare("UPDATE store_snapshot SET saved_at=? WHERE actor_id=?")
          .run(at, actorId);
        store.connection.database
          .prepare("INSERT INTO router_source_event VALUES (?,?,?)")
          .run(marker, kind, kind === "expired" ? now - (windows.source + 1) * day : now);
        store.connection.database
          .prepare(
            "INSERT INTO gates_evaluation (gate,version,evaluated_at,seed,input,outcome,duration_ms) VALUES (?, ?, ?, 1, '{}', 'none', 0)",
          )
          .run(
            `${marker}#waiting`,
            marker,
            kind === "expired" ? now - (windows.gates + 1) * day : now,
          );
      }
    });
  console.log(
    JSON.stringify({
      actors: ["uat-retention-expired", "uat-retention-recent"],
      source: marker,
      gate: `${marker}#waiting`,
      windows,
    }),
  );
} finally {
  store.close();
}
