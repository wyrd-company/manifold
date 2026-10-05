// ---
// relationships:
//   verifies: [blueprints-api, operator-console]
// ---
import { expect, it } from "vite-plus/test";
import { stringify } from "yaml";
import { blueprintGraph, findingRanges } from "./index.ts";
const document = (machine: object) =>
  stringify({ machine, schemas: { input: true, output: true, context: true, events: {} } });
it("locates mapping keys, deepest existing pointer, sequences, escaped keys, root and YAML errors", () => {
  const text = 'title: "😀"\nstates:\n  a/b:\n    invoke:\n      - src: courier\n';
  const findings = ["/states/a~1b/invoke/0/src", "/states/a~1b/missing/deeper", "", "/absent"].map(
    (location) => ({
      path: "blueprints/shipping.yml",
      kind: "shape" as const,
      location,
      message: "Invalid",
    }),
  );
  const ranged = findingRanges(text, findings);
  expect(ranged.map((row) => row.range && text.slice(row.range.from, row.range.to))).toEqual([
    "src: courier",
    "a/b:\n    invoke:\n      - src: courier\n",
    'title: "😀"',
    'title: "😀"',
  ]);
  expect(ranged[0]?.range).toMatchObject({ line: 5, column: 9 });
  expect(ranged[0]).not.toHaveProperty("path");
  expect(
    findingRanges(text, [{ ...findings[0]!, kind: "yaml", line: 1, column: 8 }])[0]?.range,
  ).toEqual({ from: 7, to: 11, line: 1, column: 8 });
});
it("resolves targets and presents nested states and transitions in document order", () => {
  const text = document({
    id: "shipment",
    initial: "packing",
    states: {
      packing: {
        initial: "box",
        states: { box: { on: { seal: "label" } }, label: { on: { dispatch: "#delivered" } } },
        on: { cancel: "delivered" },
        after: { pause: { target: "delivered", guard: "ready" } },
        invoke: { id: "courier", src: "shipping.send", onDone: "delivered", onError: "delivered" },
      },
      parallel: { type: "parallel", states: { left: {}, right: {} } },
      delivered: { id: "delivered", type: "final" },
    },
  });
  const graph = blueprintGraph(text)!;
  expect(graph.states.map((row) => [row.path, row.type, row.initial])).toEqual([
    ["packing", "compound", true],
    ["packing.box", "atomic", true],
    ["packing.label", "atomic", false],
    ["parallel", "parallel", false],
    ["parallel.left", "atomic", false],
    ["parallel.right", "atomic", false],
    ["delivered", "final", false],
  ]);
  expect(graph.states[0]?.invokes).toEqual(["shipping.send"]);
  expect(graph.states[1]).toMatchObject({
    parent: "packing",
    location: "/machine/states/packing/states/box",
    range: { line: expect.any(Number) },
  });
  expect(graph.transitions.map((row) => [row.source, row.target, row.trigger, row.label])).toEqual([
    ["packing.box", "packing.label", "event", "seal"],
    ["packing.label", "delivered", "event", "dispatch"],
    ["packing", "delivered", "event", "cancel"],
    ["packing", "delivered", "after", "pause"],
    ["packing", "delivered", "done", "courier"],
    ["packing", "delivered", "error", "courier"],
  ]);
  expect(graph.transitions[3]?.guarded).toBe(true);
});
it("preserves targetless and multi-target transitions, relative children and always transitions", () => {
  const graph = blueprintGraph(
    document({
      initial: "packing",
      states: {
        packing: {
          initial: "box",
          on: { tick: {}, select: ".box" },
          states: { box: { always: { target: ["#done", "#other"] } } },
        },
        done: { id: "done", type: "final" },
        other: { id: "other" },
      },
    }),
  )!;
  expect(graph.transitions.map((row) => [row.target, row.trigger])).toEqual([
    [undefined, "event"],
    ["packing.box", "event"],
    ["done", "always"],
    ["other", "always"],
  ]);
});
it("returns no graph for invalid YAML, shape or unresolved machine", () => {
  for (const text of [
    "[",
    "machine: {}",
    document({ initial: "missing", states: { done: { type: "final" } } }),
    document({ initial: "box", states: { box: { on: { go: "missing" } } } }),
  ])
    expect(blueprintGraph(text)).toBeUndefined();
});
it("marks the blueprint's gate metadata and resolves generated invoke identities", () => {
  const graph = blueprintGraph(
    document({
      initial: "waiting",
      states: {
        waiting: {
          meta: { gate: { comparator: "comparators/order.ts", return: "exit" } },
          invoke: [
            { src: "shipping.send", onDone: "done" },
            { id: "tracked", src: "shipping.track", onError: "done" },
          ],
        },
        done: { type: "final" },
      },
    }),
  )!;
  expect(graph.states[0]?.gated).toBe(true);
  expect(graph.transitions[0]?.label).toBe("0.(machine).waiting");
  expect(graph.transitions[1]?.label).toBe("tracked");
  expect(graph.transitions[1]?.location).toBe("/machine/states/waiting/invoke/1/onError");
});
it("rejects YAML values that do not round-trip as JSON and unresolved history or state guards", () => {
  expect(
    blueprintGraph(
      document({ initial: "waiting", context: { count: NaN }, states: { waiting: {} } }),
    ),
  ).toBeUndefined();
  expect(
    blueprintGraph(
      document({
        initial: "waiting",
        states: {
          waiting: {
            initial: "box",
            states: { box: {}, previous: { type: "history", target: "absent" } },
          },
        },
      }),
    ),
  ).toBeUndefined();
  expect(
    blueprintGraph(
      document({
        initial: "waiting",
        states: {
          waiting: {
            on: { go: { guard: { type: "in", params: { states: ["absent"] } }, target: "done" } },
          },
          done: { type: "final" },
        },
      }),
    ),
  ).toBeUndefined();
});
