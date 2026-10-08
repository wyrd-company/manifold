// ---
// relationships:
//   verifies: retention
// ---
import { openStore } from "../../store/index.ts";
import { openHistory } from "../../history/index.ts";
import { startRouter } from "../../router/index.ts";
import { openEscalations } from "../../escalations/index.ts";
import { createGates, gatesMigrationSteps } from "../../gates/index.ts";
import { createComparatorSandbox } from "../../comparator-sandbox/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../../ledger/index.ts";
import type { ActorSave } from "../../actor-host/index.ts";
import type { BlueprintDocument } from "@wyrd-company/manifold-shared";
export const day = 86400000;
export async function world(path = ":memory:") {
  let at = 1;
  const store = openStore({ path, now: () => at });
  const history = openHistory({ store, now: () => at, log: () => {} });
  const escalations = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    handlers: {},
    invocationOf: () => ({ actorId: "parcel", invokeId: "question", entryId: "1" }),
    tokenFile: () => "",
    clock: { now: () => at },
  });
  store.connection.migrate("gates", gatesMigrationSteps);
  store.connection.migrate("ledger", ledgerMigrationSteps);
  const ledger = createLedger({
    connection: store.connection,
    portfolio: parseLedgerPortfolio({
      items: [{ id: "deliveries", parent: null }],
      allocations: [{ item: "deliveries", account: "account", guarantee: 100 }],
    }),
    now: () => at,
  });
  const sandbox = await createComparatorSandbox();
  const key = `${"a".repeat(40)}:blueprints/parcels.yml`;
  const document: BlueprintDocument = {
    schemas: { input: true, context: true, output: true, events: {} },
    machine: {
      initial: "waiting",
      states: { waiting: { meta: { gate: { comparator: "order.ts", return: "exit" } } } },
    },
  };
  const gates = createGates({
    store,
    sandbox,
    escalations,
    clock: { now: () => at },
    version: async () => ({ status: "loaded", blueprint: { key, document } }),
    revisionAt: async () => ({
      commit: "a".repeat(40),
      read: async () => "export default () => null;",
    }),
    lintTokens: () => ({ gates: [], configurations: 1, configurationKey: () => "waiting" }),
    trackedIssue: () => undefined,
    portfolio: {
      ledger,
      current: () => ({
        declaration: {
          ledger: { items: [{ id: "deliveries" }], allocations: [{ account: "account" }] },
        },
      }),
    },
  });
  const host = {
    subscription: () => ({ topics: ["weather", "traffic"] }),
    restore: (snapshot: ReturnType<typeof store.activeSnapshots>[number]) => ({
      status: "restored" as const,
      target: {
        actorId: snapshot.actorId,
        send: () => {},
        persist: () => ({ machine: snapshot.machine, snapshot: snapshot.snapshot }),
      },
    }),
  };
  const router = startRouter({ store, host, clock: { now: () => at, setTimer: () => () => {} } });
  function save(actorId: string, status: "active" | "done" = "done") {
    const initial: ActorSave = {
      actorId,
      machine: key,
      snapshot: { status: "active", value: "waiting" },
      activeInvokes: [],
      entered: [],
      entries: {},
    };
    store.connection.transaction(() => {
      store.saveSnapshot(initial);
      history.saveHook(initial);
    });
    store.writeInbox(
      {
        eventId: `scan-${actorId}`,
        topic: "weather.station",
        payload: { type: "scan", reading: 42 },
      },
      [actorId],
    );
    store.markConsumed(actorId, `scan-${actorId}`);
    history.saveHook({
      ...initial,
      eventId: `scan-${actorId}`,
      changedBy: { type: "scan", eventId: `scan-${actorId}` },
    });
    history.commandSending({
      implementation: "turn-start",
      commandId: `command-${actorId}`,
      invocation: { actorId, invokeId: "send", entryId: "1" },
      environment: "station",
      threadId: `thread-${actorId}`,
      messageId: "message",
    });
    if (status === "done") {
      const ended: ActorSave = {
        ...initial,
        changedBy: { type: "scan", eventId: `scan-${actorId}` },
        snapshot: { status, value: "delivered", output: "received" },
      };
      store.connection.transaction(() => {
        store.saveSnapshot(ended);
        history.saveHook(ended);
      });
    }
  }
  function evaluation(gate = "blueprints/parcels.yml#waiting") {
    return Number(
      store.connection.database
        .prepare(
          "INSERT INTO gates_evaluation (gate,version,evaluated_at,seed,input,outcome,duration_ms) VALUES (?,?,?,1,'{}','none',0)",
        )
        .run(gate, key, at).lastInsertRowid,
    );
  }
  function token(evaluationId: number, entry: number, returned = false) {
    store.connection.database
      .prepare(
        "INSERT INTO gates_token (token_id,gate,actor_id,entry_id,evaluation_id,granted_at,returned_at,return_reason,return_state) VALUES (?,?,?,?,?,?,?, ?, ?)",
      )
      .run(
        `token:${entry}`,
        "blueprints/parcels.yml#waiting",
        `holder-${entry}`,
        entry,
        evaluationId,
        at,
        returned ? at : null,
        returned ? "ended" : null,
        returned ? "delivered" : null,
      );
  }
  return {
    store,
    history,
    router,
    gates,
    escalations,
    ledger,
    save,
    evaluation,
    token,
    time: (time: number) => {
      at = time;
    },
    now: () => at,
    close: async () => {
      gates.stop();
      router.stop();
      await escalations.stop();
      store.close();
    },
  };
}
