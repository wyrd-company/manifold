// ---
// relationships:
//   verifies: gate-runtime
// ---
import { openActorHost, recordStateEntry } from "../../actor-host/index.ts";
import type { LoadedBlueprint } from "../../blueprint-loader/index.ts";
import { createActor, createMachine, stateIn, assign } from "xstate";
import { blueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { BlueprintDocument } from "@wyrd-company/manifold-shared";
import { openStore } from "../../store/index.ts";
import type { PersistedSnapshot, StoreOptions } from "../../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../../ledger/index.ts";
import { createComparatorSandbox } from "../../comparator-sandbox/index.ts";
import { startRouter } from "../../router/index.ts";
import { openEscalations } from "../../escalations/index.ts";
import type { Gates } from "../index.ts";
import { createGates, gatesMigrationSteps } from "../index.ts";
import type { GatesOptions } from "../index.ts";
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
            waiting: {
              entry: ({ self }) =>
                recordStateEntry({ actor: self, statePath: "open.lifecycle.waiting" }),
              always: { guard: stateIn({ open: { slot: "held" } }), target: "working" },
            },
            working: {
              entry: ({ self }) =>
                recordStateEntry({ actor: self, statePath: "open.lifecycle.working" }),
              on: { pack: "packed" },
            },
            packed: {
              entry: ({ self }) =>
                recordStateEntry({ actor: self, statePath: "open.lifecycle.packed" }),
            },
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
  sourceText: string | null = source,
) {
  const store = openStore({
    path: file,
    now: () => 100,
    ...(deliveryProbe ? { probe: deliveryProbe } : {}),
  });
  const restarting = store.activeSnapshots().length > 0;
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
  let comparatorSource = sourceText;
  const revision = { commit, read: async () => comparatorSource ?? undefined };
  let gates: Gates;
  const escalations = openEscalations({
    store,
    configuration: { destinations: {}, requestTimeoutMs: 30000, retryIntervalMs: 60000 },
    tokenFile: () => "",
    handlers: {
      "held-actor": () => {},
      "stranded-token": () => {},
      "intake-failed": () => {},
      "comparator-failed": (escalation) => gates?.comparatorFailed(escalation),
    },
  });
  gates = createGates({
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
    lintTokens: () => ({ gates: [], configurations: 0, configurationKey: () => "" }),
    trackedIssue: () => undefined,
    escalations,
    clock: { now: () => 100 },
    seed: () => 7,
    ...(probe ? { probe } : {}),
  });
  if (!restarting)
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
  const loaded: LoadedBlueprint = {
    actorKinds: {},
    migrateContext: (context) => ({ status: "unchanged", context }),
    ...blueprint,
    version: { commit, path: blueprintPath },
    machine,
    warnings: [],
    tokens: { gates: [], configurations: 0, configurationKey: () => "" },
    checkRestore: () => ({ ok: true }),
  };
  const host = await openActorHost({
    store,
    blueprints: { version: async () => ({ status: "loaded", blueprint: loaded }) },
    saveHooks: [gates.saved],
    log: () => {},
    now: () => 100,
  });
  const router = startRouter({ store, host, afterDrain: gates.afterDrain });
  return {
    store,
    ledger,
    gates,
    escalations,
    blueprint,
    revision,
    setSource(text: string | null) {
      comparatorSource = text;
    },
    router,
    close: () => {
      gates.stop();
      void escalations.stop();
      router.stop();
      store.close();
    },
  };
}
