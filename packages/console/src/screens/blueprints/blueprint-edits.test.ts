// ---
// relationships:
//   verifies: operator-console
// ---
import { describe, expect, it } from "vite-plus/test";
import { parse } from "yaml";
import { applyBlueprintEdit, commitEdit } from "./blueprint-edits.ts";
import { blueprintGraph } from "@wyrd-company/manifold-shared/blueprint-graph";
const text = `# a preserved header\nschemas: { input: true, output: true, context: true, events: {} }\nmachine:\n  id: sample\n  initial: waiting # keep this\n  states:\n    waiting: # keep this too\n      entry: { type: expression.assign, params: { expression: 'context' } }\n      on:\n        NEXT: ready # reference\n    ready: { type: final }\n`;
function edit(operation: Parameters<typeof applyBlueprintEdit>[1], basis = text) {
  const result = applyBlueprintEdit(basis, operation, blueprintGraph(basis));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.message);
  return result.text;
}
describe("blueprint text edits", () => {
  it("sets a scalar without changing comments, quotes, order or other bytes", () => {
    expect(
      edit({
        kind: "set",
        pointer: "/machine/states/waiting/entry/params/expression",
        value: "context.value",
      }),
    ).toBe(text.replace("'context'", "'context.value'"));
  });
  it("adds a state and a transition while preserving the existing mapping", () => {
    const added = edit({ kind: "add-state", parent: "", type: "atomic" });
    expect(added).toContain("NEXT: ready # reference");
    expect(parse(added).machine.states.state).toEqual({});
    const connected = edit(
      {
        kind: "add-transition",
        source: "state",
        target: "ready",
        trigger: "event",
        event: "FINISH",
      },
      added,
    );
    expect(parse(connected).machine.states.state.on.FINISH).toBe("ready");
  });
  it("renames resolved references and layout without changing unrelated text", () => {
    const renamed = edit({ kind: "rename-state", path: "ready", key: "complete" });
    expect(renamed).toContain("NEXT: complete # reference");
    expect(renamed).toContain("complete: { type: final }");
    expect(renamed).toContain("expression: 'context'");
  });
  it("removes a state and its incoming transition", () => {
    const removed = parse(edit({ kind: "remove-state", path: "ready" }));
    expect(removed.machine.states.ready).toBeUndefined();
    expect(removed.machine.states.waiting.on.NEXT).toBeUndefined();
  });
  it("rejects invalid keys and edits to aliases or anchored values", () => {
    expect(
      applyBlueprintEdit(
        text,
        { kind: "rename-state", path: "ready", key: "waiting" },
        blueprintGraph(text),
      ),
    ).toMatchObject({ ok: false, reason: "invalid" });
    const anchored = text.replace("'context'", "&value context");
    expect(
      applyBlueprintEdit(anchored, {
        kind: "set",
        pointer: "/machine/states/waiting/entry/params/expression",
        value: "other",
      }),
    ).toMatchObject({ ok: false, reason: "unsafe" });
  });
  it("rejects replay on a changed basis and keeps pending saves read only", () => {
    const draft = { base: "a", baseText: text, text };
    const operation = { kind: "add-state", parent: "", type: "atomic" } as const;
    const first = commitEdit(draft, text, operation, blueprintGraph(text));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(commitEdit(first.draft, text, operation)).toMatchObject({ ok: false, reason: "stale" });
    expect(commitEdit({ ...draft, saved: "b" }, text, operation)).toMatchObject({
      ok: false,
      reason: "readonly",
    });
  });
  it("writes and clears committed layout and reports missing pointers", () => {
    const pinned = edit({
      kind: "set-layout",
      states: { waiting: { x: 8, y: 16 }, ready: { x: 8, y: 128 } },
    });
    expect(parse(pinned).layout.states.ready).toEqual({ x: 8, y: 128 });
    expect(parse(edit({ kind: "clear-layout" }, pinned)).layout).toBeUndefined();
    expect(applyBlueprintEdit(text, { kind: "remove", pointer: "/missing" })).toMatchObject({
      ok: false,
      reason: "missing",
    });
  });
});
it("keeps an untouched anchor while rejecting an edit to its value", () => {
  const anchored = text.replace("'context'", "&value context");
  const safe = applyBlueprintEdit(anchored, {
    kind: "set",
    pointer: "/machine/id",
    value: "other",
  });
  expect(safe.ok).toBe(true);
});
it("orders candidates and edits nested targets and pinned paths", () => {
  const nested = `schemas: { input: true, output: true, context: true, events: {} }\nmachine:\n  id: sample\n  initial: work\n  states:\n    work:\n      initial: first\n      states:\n        first:\n          on:\n            NEXT: [second, '#sample.done']\n        second: {}\n    done: {type: final}\nlayout:\n  states:\n    work.second: {x: 8, y: 16}\n`;
  const renamed = edit({ kind: "rename-state", path: "work.second", key: "last" }, nested);
  expect(parse(renamed).layout.states["work.last"]).toEqual({ x: 8, y: 16 });
  expect(parse(renamed).machine.states.work.states.first.on.NEXT[0]).toBe("last");
  const moved = edit(
    {
      kind: "move-candidate",
      pointer: "/machine/states/work/states/first/on/NEXT/1",
      direction: -1,
    },
    renamed,
  );
  expect(parse(moved).machine.states.work.states.first.on.NEXT[0]).toBe("#sample.done");
});
it("expands a shorthand transition for its first inspector property", () => {
  const result = edit({
    kind: "set",
    pointer: "/machine/states/waiting/on/NEXT",
    value: { target: "ready", guard: { type: "expression.guard", params: { expression: "true" } } },
  });
  expect(parse(result).machine.states.waiting.on.NEXT.guard.params.expression).toBe("true");
});
it("expands a shorthand transition inside a flow state without changing the container style", () => {
  const flow = text
    .replace("NEXT: ready # reference", "NEXT: ready # reference")
    .replace("    ready: { type: final }", "    ready: { type: final, on: { AGAIN: waiting } }");
  const result = edit(
    {
      kind: "set",
      pointer: "/machine/states/ready/on/AGAIN",
      value: {
        target: "waiting",
        guard: { type: "expression.guard", params: { expression: "true" } },
      },
    },
    flow,
  );
  expect(parse(result).machine.states.ready.on.AGAIN.guard.params.expression).toBe("true");
});
it("renames root and invoke snapshot targets, and rewrites a state id everywhere", () => {
  const basis = text
    .replace(
      "  initial: waiting # keep this",
      '  initial: waiting # keep this\n  on: { RESET: ".ready" }',
    )
    .replace("    ready: { type: final }", "    ready: { id: finish, type: final }")
    .replace("        NEXT: ready # reference", '        NEXT: "#finish" # reference');
  const withSnapshot = basis.replace(
    "    waiting: # keep this too",
    "    waiting: # keep this too\n      invoke: { src: shipping.send, id: dispatcher, onSnapshot: { target: ready } }",
  );
  const renamed = edit({ kind: "rename-state", path: "ready", key: "complete" }, withSnapshot);
  expect(parse(renamed).machine.states.waiting.invoke.onSnapshot.target).toBe("complete");
  expect(parse(renamed).machine.on.RESET).toBe(".complete");
  const changed = edit(
    { kind: "set", pointer: "/machine/states/complete/id", value: "finished" },
    renamed,
  );
  expect(parse(changed).machine.states.waiting.on.NEXT).toBe("#finished");
});
it("removes all matching transition candidates without shifting other candidates", () => {
  const basis = text.replace(
    "NEXT: ready # reference",
    "NEXT: [ready, ready, waiting] # reference",
  );
  const removed = edit({ kind: "remove-state", path: "ready" }, basis);
  expect(parse(removed).machine.states.waiting.on.NEXT).toEqual(["waiting"]);
});
it.each(["", "a.b", "#sample"])("rejects the invalid state key %s without touching text", (key) => {
  expect(
    applyBlueprintEdit(text, { kind: "rename-state", path: "ready", key }, blueprintGraph(text)),
  ).toMatchObject({ ok: false, reason: "invalid" });
});
it("reports missing states and malformed or aliased YAML without writing it", () => {
  expect(
    applyBlueprintEdit(text, { kind: "remove-state", path: "absent" }, blueprintGraph(text)),
  ).toMatchObject({ ok: false, reason: "missing" });
  expect(
    applyBlueprintEdit("machine: [", { kind: "set", pointer: "/machine/id", value: "sample" }),
  ).toMatchObject({ ok: false, reason: "unsafe" });
  const basis = text
    .replace("'context'", "&expression context")
    .replace("    ready: { type: final }", "    ready: { type: final, output: *expression }");
  expect(
    applyBlueprintEdit(basis, {
      kind: "set",
      pointer: "/machine/states/ready/output",
      value: "other",
    }),
  ).toMatchObject({ ok: false, reason: "unsafe" });
});
it("renames history targets, in guards and gate state paths", () => {
  const basis = text.replace(
    "    ready: { type: final }",
    `    memory: { type: history, target: ready }\n    check:\n      always: { target: ready, guard: { type: in, params: { states: [ready] } } }\n      meta:\n        gate: { comparator: compare.ts, return: {state: ready}, dependencies: ready }\n    ready: { type: final }`,
  );
  const renamed = parse(edit({ kind: "rename-state", path: "ready", key: "complete" }, basis));
  expect(renamed.machine.states.memory.target).toBe("complete");
  expect(renamed.machine.states.check.always.guard.params.states).toEqual(["complete"]);
  expect(renamed.machine.states.check.meta.gate.return.state).toBe("complete");
  expect(renamed.machine.states.check.meta.gate.dependencies).toBe("complete");
});

it("rejects a splice whose YAML value does not match the requested value", () => {
  expect(
    applyBlueprintEdit(text, { kind: "set", pointer: "/machine/id", value: "first\nlast\n" }),
  ).toMatchObject({ ok: false, reason: "unsafe" });
});

it("rejects field writes through missing state, candidate, or property ancestors", () => {
  for (const pointer of [
    "/machine/states/gone/description",
    "/machine/states/waiting/on/NEXT/2/guard",
    "/schemas/actors/new/input",
  ]) {
    expect(applyBlueprintEdit(text, { kind: "set", pointer, value: true })).toMatchObject({
      ok: false,
      reason: "missing",
    });
  }
});
it("attaches completion transitions only to the selected owner", () => {
  expect(
    applyBlueprintEdit(text, {
      kind: "add-transition",
      source: "waiting",
      target: "ready",
      trigger: "error",
    }),
  ).toMatchObject({ ok: false, reason: "missing" });
  expect(
    applyBlueprintEdit(text, {
      kind: "add-transition",
      source: "waiting",
      target: "ready",
      trigger: "done",
    }),
  ).toMatchObject({ ok: false, reason: "missing" });
  const basis = text.replace(
    "waiting: # keep this too",
    "waiting:\n      states: { child: {} }\n      invoke: [{ src: one }, { src: two }]",
  );
  expect(
    applyBlueprintEdit(basis, {
      kind: "add-transition",
      source: "waiting",
      target: "ready",
      trigger: "error",
    }),
  ).toMatchObject({ ok: false, reason: "missing" });
  expect(
    parse(
      edit({ kind: "add-transition", source: "waiting", target: "ready", trigger: "done" }, basis),
    ).machine.states.waiting.onDone,
  ).toBe("ready");
  expect(
    parse(
      edit(
        { kind: "add-transition", source: "waiting", target: "ready", trigger: "error", invoke: 1 },
        basis,
      ),
    ).machine.states.waiting.invoke,
  ).toEqual([{ src: "one" }, { src: "two", onError: "ready" }]);
});

it("adds a candidate to a block sequence without joining the next state onto it", () => {
  const basis = text.replace(
    "NEXT: ready # reference",
    "NEXT:\n          - ready\n          - ready",
  );
  const result = edit(
    { kind: "add-transition", source: "waiting", target: "ready", trigger: "event", event: "NEXT" },
    basis,
  );
  expect(parse(result).machine.states.waiting.on.NEXT).toEqual(["ready", "ready", "ready"]);
});

it("rejects a missing array slot and a scalar parent without hiding the stale edit as unsafe", () => {
  const basis = text.replace("NEXT: ready # reference", "NEXT: [ready]");
  expect(
    applyBlueprintEdit(basis, {
      kind: "set",
      pointer: "/machine/states/waiting/on/NEXT/2",
      value: "ready",
    }),
  ).toMatchObject({ ok: false, reason: "missing" });
  expect(
    applyBlueprintEdit(text, {
      kind: "set",
      pointer: "/machine/states/waiting/entry/type/description",
      value: "sample",
    }),
  ).toMatchObject({ ok: false, reason: "missing" });
});
it("rejects completion transitions when the chosen invoke is missing", () => {
  for (const trigger of ["done", "error"] as const) {
    expect(
      applyBlueprintEdit(text, {
        kind: "add-transition",
        source: "waiting",
        target: "ready",
        trigger,
        invoke: 0,
      }),
    ).toMatchObject({ ok: false, reason: "missing" });
  }
});

it.each([
  ["entry", "type: expression.assign", "params"],
  ["invoke", "src: thread-create", "input: { type: expression.map, params"],
  ["on:\n        NEXT", "target: ready, guard: { type: expression", "params"],
])(
  "preserves untouched sequence items and their comments when editing a nested expression (%s)",
  (collection, item, field) => {
    const extraClose = collection === "entry" ? "" : " }";
    const basis = text.replace(
      "      entry: { type: expression.assign, params: { expression: 'context' } }",
      `      ${collection}:\n        - { ${item}, ${field}: { expression: 'context.first' }${extraClose} } # first comment\n        # between items\n        - { ${item}, ${field}: { expression: "context.second" }${extraClose} } # keep second`,
    );
    const pointer =
      collection === "entry"
        ? "/machine/states/waiting/entry/0/params/expression"
        : collection === "invoke"
          ? "/machine/states/waiting/invoke/0/input/params/expression"
          : "/machine/states/waiting/on/NEXT/0/guard/params/expression";
    // Transition fixture uses its own event collection, without a duplicate on key.
    const source = collection.startsWith("on:")
      ? basis.replace("      on:\n        NEXT: ready # reference\n", "")
      : basis;
    expect(edit({ kind: "set", pointer, value: "context.changed" }, source)).toBe(
      source.replace("'context.first'", "'context.changed'"),
    );
  },
);

it("keeps edits of anchored sequences in the YAML view", () => {
  const basis = text.replace(
    "entry: { type: expression.assign, params: { expression: 'context' } }",
    "entry: &steps [{ type: expression.assign, params: { expression: 'context' } }]",
  );
  expect(
    applyBlueprintEdit(basis, {
      kind: "set",
      pointer: "/machine/states/waiting/entry/0/params/expression",
      value: "context.changed",
    }),
  ).toMatchObject({ ok: false, reason: "unsafe" });
});
