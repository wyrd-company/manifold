// ---
// relationships:
//   verifies: gate-runtime
// ---
import { createActor, createMachine, stateIn, assign } from "xstate";
import { blueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { BlueprintDocument } from "@wyrd-company/manifold-shared";
import { openStore } from "../../store/index.ts";
import type { PersistedSnapshot, StoreOptions } from "../../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../../ledger/index.ts";
import { createComparatorSandbox } from "../../comparator-sandbox/index.ts";
import { startRouter } from "../../router/index.ts";
import { createGates, gatesMigrationSteps } from "../index.ts";
import type { GatesOptions, GateSave } from "../index.ts";
export const blueprintPath = "blueprints/parcels/sorting.yml",
  commit = "a".repeat(40),
  key = blueprintVersionKey({ commit, path: blueprintPath });
const machine = createMachine({
  id: "parcel",
  initial: "open",
  context: { seen: [] as string[], manifold: { portfolioItem: "left" } },
  states: {
    open: {
      type: "parallel",
      states: {
        lifecycle: {
          initial: "waiting",
          states: {
            waiting: { always: { guard: stateIn({ open: { slot: "held" } }), target: "working" } },
            working: { on: { pack: "packed" } },
            packed: {},
            shipped: {},
          },
        },
        dependencies: { initial: "clear", states: { clear: {}, blocked: {} } },
        slot: {
          initial: "free",
          states: {
            free: {
              on: {
                token: {
                  target: "held",
                  actions: assign({
                    seen: ({ context, event }) => [...context.seen, event["tokenId"] as string],
                  }),
                },
              },
            },
            held: {},
          },
        },
      },
    },
    finished: { type: "final" },
  },
});
const document: BlueprintDocument = {
  schemas: { input: true, output: true, context: true, events: {} },
  machine: {
    states: {
      open: {
        states: {
          lifecycle: {
            states: {
              waiting: {
                meta: {
                  gate: {
                    comparator: "comparators/order.ts",
                    return: { state: "open.lifecycle.packed" },
                    reservation: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
const source = `export default i=> i.holders.length ? null : {task:[...i.population].sort((a,b)=>b.age-a.age||a.id.localeCompare(b.id))[0].id,reservations:[{account:'acct',amount:5}]};`;
export async function world(
  file: string,
  probe?: GatesOptions["probe"],
  deliveryProbe?: StoreOptions["probe"],
) {
  const store = openStore({
    path: file,
    now: () => 100,
    ...(deliveryProbe ? { probe: deliveryProbe } : {}),
  });
  store.connection.migrate("ledger", ledgerMigrationSteps);
  store.connection.migrate("gates", gatesMigrationSteps);
  const ledger = createLedger({
    connection: store.connection,
    portfolio: parseLedgerPortfolio({
      items: [{ id: "left", parent: null }],
      allocations: [{ item: "left", account: "acct", guarantee: 100 }],
    }),
    now: () => 100,
  });
  ledger.credit({
    key: "credit",
    account: "acct",
    window: "window",
    opensAt: 0,
    closesAt: 10000,
    amount: 1000,
  });
  const blueprint = { key, document };
  const revision = { commit, read: async () => source };
  const gates = createGates({
    store,
    version: async () => ({ status: "loaded", blueprint }),
    revisionAt: async () => revision,
    sandbox: await createComparatorSandbox(),
    portfolio: {
      ledger,
      current: () => ({
        declaration: { ledger: { items: [{ id: "left" }], allocations: [{ account: "acct" }] } },
      }),
    },
    lintTokens: () => ({ gates: [], configurationKey: () => "" }),
    trackedIssue: () => undefined,
    escalations: { raise: () => {}, withdraw: () => {} },
    clock: { now: () => 100 },
    seed: () => 7,
    ...(probe ? { probe } : {}),
  });
  await gates.revision({ blueprints: new Map([[blueprintPath, blueprint]]) }, revision);
  if (!store.activeSnapshots().length)
    for (let i = 0; i < 20; i++) {
      const actor = createActor(machine);
      actor.start();
      store.saveSnapshot({
        actorId: `parcel-${String(i).padStart(2, "0")}`,
        machine: key,
        snapshot: actor.getPersistedSnapshot() as PersistedSnapshot,
      });
      actor.stop();
    }
  await gates.prepare();
  const saves = new Map<string, GateSave>();
  const saveSnapshot = store.saveSnapshot.bind(store);
  store.saveSnapshot = (write) =>
    store.connection.transaction(() => {
      const result = saveSnapshot(write),
        save = saves.get(write.actorId);
      if (save) gates.saved({ ...save, snapshot: write.snapshot });
      return result;
    });
  const actors: ReturnType<typeof createActor<typeof machine>>[] = [];
  const router = startRouter({
    store,
    afterDrain: gates.afterDrain,
    host: {
      subscription: () => ({ topics: [] }),
      restore: (stored) => {
        const actor = createActor(machine, {
          snapshot: stored.snapshot as ReturnType<typeof machine.getPersistedSnapshot>,
        });
        actor.start();
        actors.push(actor);
        return {
          status: "restored",
          target: {
            actorId: stored.actorId,
            send: (row) => actor.send(row.payload as { type: string }),
            persist: () => {
              const snapshot = actor.getPersistedSnapshot() as PersistedSnapshot;
              const save: GateSave = {
                actorId: stored.actorId,
                machine: key,
                snapshot,
                activeInvokes: [],
                entered: [],
                entries: { "open.lifecycle.waiting": "waiting-entry" },
              };
              saves.set(stored.actorId, save);
              return { machine: key, snapshot };
            },
          },
        };
      },
    },
  });
  return {
    store,
    ledger,
    gates,
    router,
    close: () => {
      gates.stop();
      router.stop();
      for (const actor of actors) actor.stop();
      store.close();
    },
  };
}
