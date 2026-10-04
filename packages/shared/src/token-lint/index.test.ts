// ---
// relationships:
//   verifies: token-lint
// ---
import { describe, expect, it } from "vite-plus/test";
import { createActor, createMachine } from "xstate";
import type { MachineConfig } from "xstate";
import { gate, document, flat, result, verdict, fixtures } from "./test-fixtures/blueprints.ts";
describe("token lint", () => {
  it.each(fixtures)("%s", (_name, doc, expected) => expect(verdict(doc)).toBe(expected));
  it("sees a return entered and left in one macrostep", () => {
    const doc = flat({ on: { finish: "returned" } });
    (doc.machine["states"] as Record<string, unknown>)["returned"] = { always: "broken" };
    (doc.machine["states"] as Record<string, unknown>)["broken"] = {};
    expect(verdict(doc)).toBe("proved");
  });
  it("returns unknown without traps at the configuration bound", () => {
    const lint = result(flat({ on: { finish: "returned" } }), 1);
    expect(lint.gates[0]).toMatchObject({
      verdict: "unknown",
      findings: [{ kind: "token-unknown", configurationBound: 1 }],
    });
    expect(lint.gates[0]!.traps).toBeUndefined();
  });
  it("carries a guard choice and a grant in the witness", () => {
    const finding = result(fixtures[8]![1]).gates[0]!.findings[0]!;
    expect(finding.choices).toContainEqual(
      expect.objectContaining({ value: false, location: "/machine/states/queued/on/token/guard" }),
    );
    expect(finding.steps).toContainEqual(expect.objectContaining({ event: "token", grant: true }));
  });
  it("branches declared raised events", () => {
    const doc = flat({ entry: "signal", on: { finish: "returned", break: "broken" } });
    (doc.machine["states"] as Record<string, unknown>)["broken"] = {};
    // Every entry evaluates the declared raise, so this path has a choice.
    expect(verdict(doc)).toBe("potential");
    const onlyRaised = flat({}, { on: { token: { target: "returned", actions: "signal" } } });
    (onlyRaised.machine["states"] as Record<string, unknown>)["returned"] = {
      on: { break: "broken" },
    };
    (onlyRaised.machine["states"] as Record<string, unknown>)["broken"] = {};
    expect(verdict(onlyRaised)).toBe("proved");
  });
  it("does not grant twice within an entry but grants after exit and history re-entry", () => {
    const doc = document({
      initial: "packing",
      states: {
        packing: {
          initial: "queued",
          meta: { gate: { ...gate, return: { state: "packing.returned" } } },
          states: {
            queued: { on: { token: "returned" } },
            returned: { on: { token: "trap" } },
            trap: {},
            history: { type: "history" },
          },
        },
        away: { on: { resume: "packing.history" } },
        done: { type: "final" },
      },
    });
    expect(verdict(doc)).toBe("proved");
    const packing = (doc.machine["states"] as Record<string, Record<string, unknown>>)["packing"]!;
    packing["on"] = { leave: "away" };
    expect(verdict(doc)).toBe("violation");
  });
  it("uses persisted history and collision-free state ids", () => {
    const doc = document({
      initial: "packing",
      states: {
        packing: {
          initial: "queued",
          meta: { gate },
          states: {
            queued: { on: { token: "trap" } },
            trap: {},
            history: { type: "history", history: "deep" },
          },
          on: { leave: "away" },
        },
        away: { on: { resume: "packing.history" } },
        returned: {},
        done: { type: "final" },
      },
    });
    const lint = result(doc);
    const actor = createActor(
      createMachine(doc.machine as MachineConfig<Record<string, unknown>, { type: string }>),
    ).start();
    actor.send({ type: "token" });
    actor.send({ type: "leave" });
    actor.send({ type: "resume" });
    expect(lint.gates[0]!.traps!.has(lint.configurationKey(actor.getPersistedSnapshot()))).toBe(
      true,
    );
    const before = lint.configurationKey(actor.getPersistedSnapshot());
    const withoutHistory = { ...actor.getPersistedSnapshot(), historyValue: {} };
    expect(lint.configurationKey(withoutHistory)).not.toBe(before);
    actor.stop();
  });
});

it("does not alias active configurations containing delimiters in ids", () => {
  const doc = document({
    initial: "open",
    states: {
      open: {
        type: "parallel",
        states: {
          left: {
            initial: "a",
            states: {
              a: {
                id: "x,y",
                meta: { gate: { ...gate, return: { state: "open.left.b" } } },
                on: { token: "b" },
              },
              b: { id: "x" },
            },
          },
          right: { initial: "a", states: { a: { id: "z", on: { flip: "b" } }, b: { id: "y,z" } } },
        },
      },
      returned: {},
      done: { type: "final" },
    },
  });
  const lint = result(doc),
    actor = createActor(
      createMachine(doc.machine as MachineConfig<Record<string, unknown>, { type: string }>),
    ).start();
  const first = lint.configurationKey(actor.getPersistedSnapshot());
  actor.send({ type: "token" });
  actor.send({ type: "flip" });
  expect(lint.configurationKey(actor.getPersistedSnapshot())).not.toBe(first);
  expect(lint.configurations).toBeGreaterThan(2);
  actor.stop();
});
it("bounds choice scripts and eventless loops without calling either proved", () => {
  const opaque = flat(
    {},
    { on: { token: [{ target: "returned", guard: "allowed" }, { target: "working" }] } },
  );
  expect(result(opaque, 2).gates[0]!.verdict).toBe("unknown");
  const loop = flat({ always: "broken" });
  (loop.machine["states"] as Record<string, unknown>)["broken"] = { always: "working" };
  expect(result(loop, 10).gates[0]!.verdict).toBe("unknown");
});
it("keeps two independent gates in document order", () => {
  const doc = flat(
    { meta: { gate: { ...gate, token: "second" } }, on: { second: "returned" } },
    { meta: { gate: { ...gate, return: "exit" } } },
  );
  expect(result(doc).gates.map((gate) => [gate.statePath, gate.verdict])).toEqual([
    ["queued", "proved"],
    ["working", "proved"],
  ]);
});

it("grants on a later entry when the previous token returned after leaving the gate", () => {
  const doc = document({
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
                    { target: "working" },
                  ],
                },
              },
              working: { on: { finish: "returned" } },
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
  expect(verdict(doc)).toBe("violation");
});

it("stops a nine-region product at 1000 configurations", async () => {
  const { manyRegions } = await import("./test-fixtures/blueprints.ts");
  const lint = result(manyRegions, 1000);
  expect(lint.configurations).toBe(1000);
  expect(lint.gates[0]).toMatchObject({ verdict: "unknown", findings: [{ configurations: 1000 }] });
});
it("matches real persisted snapshots for the active-set history counterexample and repeated grants", async () => {
  const { historyCounterexample, repeatedGrant } = await import("./test-fixtures/blueprints.ts");
  const { compileStateGuards } = await import("../state-guards.ts");
  for (const [doc, events] of [
    [historyCounterexample, ["bad", "leave", "token", "again"]],
    [repeatedGrant, ["token", "again", "token"]],
  ] as const) {
    const lint = result(doc),
      actor = createActor(
        createMachine(
          compileStateGuards(doc.machine) as MachineConfig<
            Record<string, unknown>,
            { type: string }
          >,
        ),
      ).start();
    for (const type of events) actor.send({ type });
    expect(lint.gates[0]!.traps!.has(lint.configurationKey(actor.getPersistedSnapshot()))).toBe(
      true,
    );
    actor.stop();
  }
});

it("explores the true branch of an opaque guard after an unconditional grant", () => {
  const doc = flat({ on: { finish: "returned", break: { target: "broken", guard: "allowed" } } });
  (doc.machine["states"] as Record<string, unknown>)["broken"] = {};
  const finding = result(doc).gates[0]!.findings[0]!;
  expect(verdict(doc)).toBe("potential");
  expect(finding.choices).toContainEqual(expect.objectContaining({ value: true }));
});
it("records the declared raise choice in the witness", () => {
  const doc = flat({ entry: "signal", on: { finish: "returned", break: "broken" } });
  (doc.machine["states"] as Record<string, unknown>)["broken"] = {};
  const finding = result(doc).gates[0]!.findings[0]!;
  expect(finding.kind).toBe("token-potential");
  expect(finding.choices).toContainEqual(expect.objectContaining({ raises: "break" }));
});

it("never resends a token while it is held", () => {
  const doc = document({
    initial: "packing",
    states: {
      packing: {
        initial: "queued",
        meta: { gate: { ...gate, return: { state: "packing.returned" } } },
        states: {
          queued: { on: { token: "working" } },
          working: { on: { token: "returned" } },
          returned: {},
        },
      },
      done: { type: "final" },
    },
  });
  expect(verdict(doc)).toBe("violation");
});
it("bounds opaque scripts even when they reach the same configuration", () => {
  const doc = flat(
    {},
    {
      on: {
        token: [
          { target: "returned", guard: "allowed" },
          { target: "returned", guard: "allowed" },
          { target: "returned", guard: "allowed" },
          { target: "returned" },
        ],
      },
    },
  );
  expect(result(doc, 3).gates[0]!.verdict).toBe("unknown");
  expect(result(doc, 10).gates[0]!.verdict).toBe("proved");
});
it("orders ids by code point and includes actor status in the key", () => {
  const doc = document({
    type: "parallel",
    states: { left: { id: "\ue000" }, right: { id: "\u{10000}" } },
  });
  const lint = result(doc),
    actor = createActor(
      createMachine(doc.machine as MachineConfig<Record<string, unknown>, { type: string }>),
    ).start();
  const key = lint.configurationKey(actor.getPersistedSnapshot());
  expect(JSON.parse(key)[0]).toEqual(["sample", "\ue000", "\u{10000}"]);
  const stopped = {
    ...actor.getPersistedSnapshot(),
    status: "stopped" as const,
    output: undefined,
    error: undefined,
  };
  expect(lint.configurationKey(stopped)).not.toBe(key);
  actor.stop();
});

it("explores overlapping wildcard prefixes without trying to avoid their ancestors", () => {
  const doc = flat({ on: { "parcel.*": "returned", "parcel.scan.*": "broken" } });
  (doc.machine["states"] as Record<string, unknown>)["broken"] = {};
  expect(verdict(doc)).toBe("violation");
});
