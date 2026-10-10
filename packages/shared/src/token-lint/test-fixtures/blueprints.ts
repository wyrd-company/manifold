// ---
// relationships:
//   verifies: token-lint
// ---
import { lintTokens } from "../index.ts";
import type { BlueprintDocument } from "../../blueprint-lint.ts";
export const names = {
  actors: new Set(["worker"]),
  actions: new Set(["signal"]),
  guards: new Set(["allowed"]),
  delays: new Set(["wait"]),
  raises: new Map([["signal", ["break"]]]),
};
export const gate = { comparator: "comparators/order.ts", return: { state: "returned" } };
export function document(machine: Record<string, unknown>): BlueprintDocument {
  return {
    machine: { id: "sample", ...machine },
    schemas: { input: true, output: true, context: true, events: {} },
  };
}
export function flat(working: Record<string, unknown> = {}, queued: Record<string, unknown> = {}) {
  return document({
    initial: "queued",
    states: {
      queued: { meta: { gate }, on: { token: "working" }, ...queued },
      working,
      returned: {},
      done: { type: "final" },
    },
  });
}
export const result = (doc: BlueprintDocument, configurationBound?: number) =>
  lintTokens(doc, { names, ...(configurationBound === undefined ? {} : { configurationBound }) });
export const verdict = (doc: BlueprintDocument) => result(doc).gates[0]!.verdict;
export const fixtures: [string, BlueprintDocument, string][] = [
  ["dead end", flat(), "violation"],
  ["closed cycle", flat({ on: { loop: "working" } }), "violation"],
  ["unreachable return", flat({ on: { finish: "done" } }), "potential"],
  ["cycle with return", flat({ on: { loop: "working", finish: "returned" } }), "proved"],
  ["exit return", flat({}, { meta: { gate: { ...gate, return: "exit" } } }), "proved"],
  ["transient return", flat({ always: "returned" }, {}), "proved"],
  ["eventless bypass", flat({ always: "broken", on: { advance: "returned" } }), "violation"],
  ["root final completion", flat({ always: "done" }), "proved"],
  [
    "guard choice",
    flat({}, { on: { token: { target: "working", guard: "allowed" } } }),
    "potential",
  ],
  ["invoke completion", flat({ invoke: { src: "worker", onDone: "returned" } }), "proved"],
  ["delay completion", flat({ after: { wait: "returned" } }), "proved"],
  ["wildcard strand", flat({ on: { finish: "returned", "break.*": "broken" } }, {}), "violation"],
];
// Give the bypass and wildcard real destinations.
(fixtures[6]![1].machine["states"] as Record<string, unknown>)["broken"] = {};
fixtures[11]![1].machine["states"] = {
  ...(fixtures[11]![1].machine["states"] as object),
  broken: {},
};

function parallel(flow: Record<string, unknown>, side: Record<string, unknown> = {}) {
  return document({
    initial: "open",
    states: {
      open: {
        type: "parallel",
        on: { cancel: "#sample.done" },
        states: {
          flow: {
            initial: "queued",
            states: {
              queued: {
                meta: { gate: { ...gate, return: { state: "open.flow.returned" } } },
                on: { token: "working" },
              },
              working: flow,
              returned: {},
              broken: {},
            },
          },
          side: {
            initial: "fresh",
            states: { fresh: { on: { change: "changed" } }, changed: {} },
            ...side,
          },
        },
      },
      done: { type: "final" },
    },
  });
}
const regionFinal = parallel({ type: "final" });
delete (regionFinal.machine["states"] as Record<string, Record<string, unknown>>)["open"]!["on"];
fixtures.push(
  [
    "parallel-region strand",
    parallel({
      on: {
        finish: {
          target: "returned",
          guard: { type: "in", params: { states: ["open.side.fresh"] } },
        },
      },
    }),
    "potential",
  ],
  [
    "ancestor trap",
    document({
      initial: "open",
      states: {
        open: {
          initial: "queued",
          on: { break: "broken", cancel: "done" },
          states: {
            queued: {
              meta: { gate: { ...gate, return: { state: "open.returned" } } },
              on: { token: "working" },
            },
            working: { on: { finish: "returned" } },
            returned: {},
          },
        },
        broken: { on: { cancel: "done" } },
        done: { type: "final" },
      },
    }),
    "potential",
  ],
  [
    "multi-target trap",
    parallel({
      on: {
        finish: {
          target: "returned",
          guard: { type: "in", params: { states: ["open.side.fresh"] } },
        },
        break: { target: ["#sample.open.flow.broken", "#sample.open.side.changed"] },
      },
    }),
    "potential",
  ],
  ["eventless grant bypass", flat({ always: "broken", on: { advance: "returned" } }), "violation"],
  ["region final is not actor completion", regionFinal, "violation"],
  [
    "exact in guard",
    parallel({
      on: {
        finish: "returned",
        impossible: {
          target: "broken",
          guard: { type: "in", params: { states: ["open.side.fresh", "open.side.changed"] } },
        },
      },
    }),
    "proved",
  ],
);
(fixtures.at(-3)![1].machine["states"] as Record<string, unknown>)["broken"] = {};
for (const history of ["shallow", "deep"]) {
  fixtures.push([
    `${history} history trap`,
    document({
      initial: "box",
      states: {
        box: {
          initial: "queued",
          states: {
            queued: {
              meta: { gate: { ...gate, return: { state: "box.returned" } } },
              on: { token: "working" },
            },
            working: { on: { bad: "trap", advance: "returned" } },
            trap: { on: { leave: "#sample.outside" } },
            returned: {},
            memory: { type: "history", history },
          },
        },
        outside: { on: { back: "box.memory" } },
        done: { type: "final" },
      },
    }),
    "violation",
  ]);
}
// Two queued configurations have the same active states and different remembered box states.
export const historyCounterexample = document({
  initial: "choose",
  states: {
    choose: { on: { good: "box", bad: { target: "#sample.box.trap" } } },
    box: {
      initial: "safe",
      states: {
        safe: { on: { leave: "#sample.queued", back: "#sample.returned" } },
        trap: { on: { leave: "#sample.queued", again: "trap" } },
        memory: { type: "history", history: "deep" },
      },
    },
    queued: {
      meta: { gate: { ...gate, return: { state: "box.safe" } } },
      on: { token: "working" },
    },
    working: { always: "#sample.box.memory" },
    returned: {},
    done: { type: "final" },
  },
});
fixtures.push(["active-set history false acceptance", historyCounterexample, "violation"]);
export const repeatedGrant = document({
  initial: "open",
  states: {
    open: {
      type: "parallel",
      states: {
        flow: {
          initial: "queued",
          states: {
            queued: {
              meta: { gate: { ...gate, return: { state: "open.flow.returned" } } },
              on: {
                token: [
                  {
                    target: "broken",
                    guard: { type: "in", params: { states: ["open.side.changed"] } },
                  },
                  { target: "returned" },
                ],
              },
            },
            returned: { on: { again: "queued" } },
            broken: {},
          },
        },
        side: {
          initial: "fresh",
          states: {
            fresh: {
              on: {
                again: {
                  target: "changed",
                  guard: { type: "in", params: { states: ["open.flow.returned"] } },
                },
              },
            },
            changed: {},
          },
        },
      },
    },
    done: { type: "final" },
  },
});
fixtures.push(["repeated grants reach a later trap", repeatedGrant, "violation"]);

export const manyRegions = document({
  initial: "open",
  states: {
    open: {
      type: "parallel",
      states: Object.fromEntries(
        Array.from({ length: 9 }, (_, index) => [
          `region${index}`,
          {
            initial: "queued",
            states: {
              queued: {
                ...(index === 0
                  ? { meta: { gate: { ...gate, return: { state: "open.region0.returned" } } } }
                  : {}),
                on: { [index === 0 ? "token" : `advance${index}`]: "working" },
              },
              working: { on: { [`finish${index}`]: "returned" } },
              returned: { on: { [`restart${index}`]: "queued" } },
            },
          },
        ]),
      ),
    },
    done: { type: "final" },
  },
});

fixtures.push(
  [
    "invoke without onError returns normally",
    flat({ invoke: { src: "worker", onDone: "returned" } }),
    "proved",
  ],
  [
    "invoke without onError reaches a dead end",
    flat({ invoke: { src: "worker", onDone: "broken" } }),
    "violation",
  ],
);
(fixtures.at(-1)![1].machine["states"] as Record<string, unknown>)["broken"] = {};
