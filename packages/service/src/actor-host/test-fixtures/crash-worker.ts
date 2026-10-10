// ---
// relationships:
//   verifies: actor-host
// ---
import { fromPromise } from "xstate";
import { stringify } from "yaml";
import { memoryRevision } from "@wyrd-company/manifold-shared";
import { createBlueprintLoader } from "../../blueprint-loader/index.ts";
import { openStore } from "../../store/index.ts";
import { startRouter } from "../../router/index.ts";
import { invocationOf, openActorHost, recordStateEntry } from "../index.ts";

const [path, mode] = process.argv.slice(2);
if (!path || !mode) throw new Error("Expected database path and crash mode");
let time = 100;
const schemas = {
  input: true,
  output: true,
  context: { type: "object" },
  events: { scanned: true },
};
const revision = memoryRevision("a".repeat(40), {
  "blueprints/parcel.yml": stringify({
    schemas,
    machine: {
      id: "parcel",
      initial: "waiting",
      context: {},
      states: {
        waiting: { on: { scanned: "sorting" } },
        sorting: {
          type: "parallel",
          onDone: "delivered",
          states: {
            timer: {
              initial: "waiting",
              states: { waiting: { after: { 100: "ready" } }, ready: { type: "final" } },
            },
            courier: {
              initial: "waiting",
              states: {
                waiting: {
                  invoke: {
                    id: "courier",
                    src: "courier",
                    onDone: { target: "ready", actions: "result" },
                  },
                },
                ready: { type: "final" },
              },
            },
            delivery: {
              initial: "waiting",
              states: {
                waiting: { invoke: { id: "child", src: "blueprints/child.yml", onDone: "ready" } },
                ready: { type: "final" },
              },
            },
          },
        },
        delivered: { type: "final" },
      },
    },
  }),
  "blueprints/child.yml": stringify({
    schemas,
    machine: {
      id: "child",
      initial: "waiting",
      context: {},
      states: { waiting: { after: { 150: "delivered" } }, delivered: { type: "final" } },
    },
  }),
});
let store = openStore({
  path,
  now: () => time,
  probe: (step) => {
    if (mode === "sent" && step === "sent") process.kill(process.pid, "SIGKILL");
  },
});
store.connection.database.exec(
  "CREATE TABLE IF NOT EXISTS test_effect (id TEXT PRIMARY KEY) STRICT",
);
const loader = createBlueprintLoader({
  revisionAt: async () => revision,
  onStateEntry: recordStateEntry,
  onExpressionError: (error) => {
    throw error;
  },
  implementations: {
    actors: {
      courier: fromPromise(async (args) => {
        const invocation = invocationOf(args);
        store.connection.database
          .prepare("INSERT INTO test_effect VALUES (?) ON CONFLICT DO NOTHING")
          .run(`${invocation.actorId}:${invocation.invokeId}:${invocation.entryId}`);
        return { delivered: true };
      }),
    },
    actions: {
      result: () => {
        if (mode === "promise") queueMicrotask(() => process.kill(process.pid, "SIGKILL"));
      },
    },
    guards: {},
    delays: {},
  },
});
const load = await loader.version({ commit: revision.commit, path: "blueprints/parcel.yml" });
if (load.status !== "loaded") throw new Error(JSON.stringify(load));
if (mode !== "resume")
  for (let i = 0; i < 4; i++)
    store.saveSnapshot({
      actorId: `other-${i}`,
      machine: load.blueprint.key,
      snapshot: { status: "done", value: "delivered", context: {} },
    });
const clock = { now: () => time, setTimer: () => () => {} };
async function open() {
  const host = await openActorHost({
    store,
    blueprints: loader,
    saveHooks: [],
    now: () => time,
    log: (entry) => {
      throw new Error(JSON.stringify(entry));
    },
  });
  return { host, router: startRouter({ store, host, clock }) };
}
let running = await open();
if (mode !== "resume") {
  running.host.start({
    actorId: "parcel",
    blueprint: load.blueprint,
    input: { manifold: { issue: "parcel-node" } },
  });
  running.router.publish({
    source: "github",
    eventId: "scan",
    topics: ["github.issue.parcel-node"],
    event: { type: "scanned" },
  });
}
await new Promise<void>((done) => setImmediate(done));
await new Promise<void>((done) => setImmediate(done));
time = 300;
for (const deadline of store.dueDeadlines(time))
  store.fireDeadline(deadline, `deadline.${deadline.deadlineId}`);
running.router.stop();
store.close();
store = openStore({ path, now: () => time });
running = await open();
await new Promise<void>((done) => setImmediate(done));
running.router.stop();
store.close();
