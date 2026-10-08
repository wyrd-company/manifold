// ---
// relationships:
//   verifies: comparator-sandbox
// ---
import { describe, expect, it } from "vite-plus/test";
import { createComparatorSandbox, comparatorSandboxDefaults } from "./index.ts";

const input = {
  population: [
    {
      id: "a",
      fields: { weight: 3 },
      age: 42,
      dependencies: "clear" as const,
      criticalPath: 1,
      item: "left",
    },
  ],
  holders: [],
  balances: { left: { credit: 20 } },
};
const good = 'export default () => ({ task: "a" });';

async function loaded(text = good, limits = { timeoutMs: 50, memoryLimitMiB: 32 }) {
  const sandbox = await createComparatorSandbox(limits);
  const load = await sandbox.load({ name: "sample.ts", text });
  if (!load.ok) throw new Error(JSON.stringify(load.failure));
  return { sandbox, comparator: load.comparator };
}

describe("comparator sandbox", () => {
  it("declares shipped limits and accepts both memory boundaries", async () => {
    expect(comparatorSandboxDefaults).toEqual({ timeoutMs: 100, memoryLimitMiB: 32 });
    // Paired gates can expire healthy evaluation at the shipped 100 ms budget.
    for (const memoryLimitMiB of [16, 2048]) {
      const { comparator } = await loaded(good, { timeoutMs: 500, memoryLimitMiB });
      expect(comparator.evaluate(input, 1)).toMatchObject({ ok: true, selection: { task: "a" } });
      comparator.dispose();
    }
  });
  it.each([
    { memoryLimitMiB: 15 },
    { memoryLimitMiB: 2049 },
    { memoryLimitMiB: 16.5 },
    { timeoutMs: 0 },
    { timeoutMs: 1.5 },
    { timeoutMs: NaN },
  ])("rejects invalid limits %j", async (limits) => {
    await expect(createComparatorSandbox(limits)).rejects.toThrow(RangeError);
  });
  it.each([
    'import x from "external"; export default () => x;',
    'import "external"; export default () => null;',
    'export { x } from "external"; export default () => null;',
    'export type { X } from "external"; export default () => null;',
    'import("external"); export default () => null;',
    'export default () => import("external");',
    "export default () => import.meta;",
    'import x = require("external"); export default () => x;',
  ])("rejects a module reference: %s", async (text) => {
    const sandbox = await createComparatorSandbox();
    expect(await sandbox.load({ name: "sample.ts", text })).toMatchObject({
      ok: false,
      failure: { kind: "module" },
    });
  });
  it("accepts erased type imports", async () => {
    for (const prefix of [
      'import type { Comparator } from "manifold:comparator";',
      'import { type Comparator } from "manifold:comparator";',
    ]) {
      const { comparator } = await loaded(
        `${prefix} const pick: Comparator = () => ({ task: "a" }); export default pick;`,
      );
      expect(comparator.evaluate(input, 1).ok).toBe(true);
      comparator.dispose();
    }
  });
  it.each([
    'require("external")',
    'fetch("https://example.invalid")',
    "process.env",
    "setTimeout(() => {}, 1)",
    "Date.now()",
    "new Date()",
    "Math.random()",
    "console.log(1)",
    "performance.now()",
  ])("blocks world access: %s", async (expression) => {
    const { comparator } = await loaded(`export default () => { ${expression}; return null; };`);
    expect(comparator.evaluate(input, 1)).toMatchObject({ ok: false, failure: { kind: "thrown" } });
    comparator.dispose();
  });
  it("copies input, resets module state, and produces seeded draws", async () => {
    const { comparator } = await loaded(
      `let count = 0; export default input => { count++; input.population[0].fields.weight = 9; return { task: 'a', reservations: [{ account: 'credit', amount: count + Math.ceil((input.random() + input.random()) * 100) + input.population[0].age }] }; };`,
    );
    const first = comparator.evaluate(input, 1234);
    expect(first).toMatchObject({ ok: true });
    const second = comparator.evaluate(input, 1234);
    expect(second.ok && second.selection).toEqual(first.ok && first.selection);
    const different = comparator.evaluate(input, 99);
    expect(different.ok && different.selection).not.toEqual(first.ok && first.selection);
    expect(input.population[0]?.fields.weight).toBe(3);
    comparator.dispose();
    comparator.dispose();
    expect(() => comparator.evaluate(input, 1)).toThrow(/disposed/);
  });
  it.each([
    "undefined",
    "true",
    '"a"',
    "{}",
    '{ task: "a", reservations: null }',
    '{ task: "a", reservations: {} }',
    '{ task: "a", reservations: [null] }',
    '{ task: "a", reservations: [{ account: 1, amount: 1 }] }',
    '{ task: "a", reservations: [{ account: "credit", amount: "1" }] }',
    '{ task: "a", reservations: [{ account: "credit", amount: 0 }] }',
    "Promise.resolve(null)",
    '({ task: "a", then() {}, toJSON() { return { task: "a" }; } })',

    '{ task: "missing" }',
    '{ task: "a", extra: 1 }',
    '{ task: "a", reservations: [{}] }',
    '{ task: "a", reservations: [{ account: "credit", amount: -1 }] }',
    '{ task: "a", reservations: [{ account: "", amount: 1 }] }',
    '{ task: "a", reservations: [{ account: "credit", amount: Infinity }] }',
    '{ task: "a", reservations: [{ account: "credit", amount: 1, extra: 1 }] }',
    "[]",
    "3",
  ])("rejects invalid output %s and recovers", async (value) => {
    const { comparator } = await loaded(
      `export default input => input.holders.length ? ({ task: 'a' }) : (${value});`,
    );
    expect(comparator.evaluate(input, 1)).toMatchObject({
      ok: false,
      failure: { kind: "invalid-output" },
    });
    expect(comparator.evaluate({ ...input, holders: [{ id: "b", item: "right" }] }, 1).ok).toBe(
      true,
    );
    comparator.dispose();
  });
  it.each([
    "null",
    '{ task: "a" }',
    '{ task: "a", reservations: [] }',
    '{ task: "a", reservations: [{ account: "credit", amount: 2 }] }',
  ])("accepts valid output %s", async (value) => {
    const { comparator } = await loaded(`export default () => (${value});`);
    expect(comparator.evaluate(input, 1)).toMatchObject({
      ok: true,
      selection: JSON.parse(JSON.stringify(Function(`return (${value})`)())),
    });
    comparator.dispose();
  });
  it.each([
    ["export default () => {", "transpile"],
    ["export default 1;", "module"],
    ["export const pick = () => null;", "module"],
    ['throw new Error("sample"); export default () => null;', "module"],
    ["await Promise.resolve(); export default () => null;", "module"],
    ["for (;;) {} export default () => null;", "timeout"],
  ])("fails a load with %s as %s", async (text, kind) => {
    const sandbox = await createComparatorSandbox({ timeoutMs: 50 });
    expect(await sandbox.load({ name: "sample.ts", text: text! })).toMatchObject({
      ok: false,
      failure: { kind },
    });
    const next = await sandbox.load({ name: "next.ts", text: good });
    expect(next.ok).toBe(true);
    if (next.ok) next.comparator.dispose();
  });
  it.each([
    ["infinite loop", "for (;;) {}", "timeout", 32, 50, 1000],
    ["small-array churn", "for (;;) { new Array(1024).fill(1); }", "timeout", 32, 50, 1000],
    [
      "small-array hoard",
      "const h = []; for (;;) h.push(new Array(1024).fill(1));",
      "memory",
      16,
      500,
      1000,
    ],
    [
      "large-array hoard",
      "const h = []; for (;;) h.push(new Array(1_000_000).fill(1));",
      "memory",
      32,
      500,
      1000,
    ],
    // A native builtin does not poll the interrupt handler, so it runs to completion past the
    // deadline at the host's speed. Its wall-clock bound proves it returns, not how fast.
    ["native join", "new Array(2_000_000).fill(1).join();", "timeout", 256, 50, 5000],
    ["native sort", "new Array(2_000_000).fill(1).sort();", "timeout", 256, 50, 5000],
  ] as const)(
    "contains %s within time and host memory bounds",
    { timeout: 10_000 },
    async (_name, body, kind, memoryLimitMiB, timeoutMs, wallMs) => {
      const { sandbox, comparator } = await loaded(
        `export default () => { ${body} return { task: 'a' }; };`,
        { timeoutMs, memoryLimitMiB },
      );
      const rss = process.memoryUsage().rss;
      const start = performance.now();
      const result = comparator.evaluate(input, 1);
      expect(result).toMatchObject({
        ok: false,
        failure: { kind },
        durationMs: expect.any(Number),
      });
      expect(performance.now() - start).toBeLessThan(wallMs);
      expect(process.memoryUsage().rss - rss).toBeLessThan((memoryLimitMiB + 64) * 1024 * 1024);
      comparator.dispose();
      const next = await sandbox.load({ name: "next.ts", text: good });
      expect(next.ok).toBe(true);
      if (next.ok) {
        expect(next.comparator.evaluate(input, 1).ok).toBe(true);
        next.comparator.dispose();
      }
    },
  );
  it("rejects a finite small-array hoard above the configured memory bound and recovers", async () => {
    const { comparator } = await loaded(
      `export default input => { if (!input.holders.length) { const h = []; for (let i = 0; i < 45_000; i++) h.push(new Array(100).fill(1)); return { task: 'a', reservations: [{ account: 'credit', amount: h.length }] }; } return { task: 'a' }; };`,
      // The finite allocation reaches the 500 ms limit at 688 ms in a loaded trace.
      { timeoutMs: 2000, memoryLimitMiB: 32 },
    );
    expect(comparator.evaluate(input, 1)).toMatchObject({ ok: false, failure: { kind: "memory" } });
    expect(
      comparator.evaluate({ ...input, holders: [{ id: "b", item: "right" }] }, 1),
    ).toMatchObject({ ok: true, selection: { task: "a" } });
    comparator.dispose();
  });
  it("keeps explicit null throws distinct from memory exhaustion after recovery", async () => {
    const { comparator } = await loaded(
      `export default input => {
        if (!input.holders.length) {
          // One request exceeds the memory bound before a timed allocation loop can interrupt.
          const h = new Array(2_000_000).fill(1);
          return { task: 'a', reservations: [{ account: 'credit', amount: h.length }] };
        }
        throw null;
      };`,
      { timeoutMs: 500, memoryLimitMiB: 32 },
    );
    expect(comparator.evaluate(input, 1)).toMatchObject({ ok: false, failure: { kind: "memory" } });
    expect(
      comparator.evaluate({ ...input, holders: [{ id: "b", item: "right" }] }, 1),
    ).toMatchObject({
      ok: false,
      failure: { kind: "thrown", message: "sample.ts: Error: null" },
    });
    comparator.dispose();
  });
  it("records tight recursion as engine, spends the instance, and permits reloading", async () => {
    const { sandbox, comparator } = await loaded("export default function f() { return f(); }", {
      timeoutMs: 500,
      memoryLimitMiB: 32,
    });
    expect(comparator.evaluate(input, 1)).toMatchObject({ ok: false, failure: { kind: "engine" } });
    expect(comparator.evaluate(input, 1)).toMatchObject({
      ok: false,
      failure: { kind: "engine" },
      durationMs: 0,
    });
    comparator.dispose();
    const replacement = await sandbox.load({ name: "next.ts", text: good });
    expect(replacement.ok).toBe(true);
    if (replacement.ok) {
      expect(replacement.comparator.evaluate(input, 1).ok).toBe(true);
      replacement.comparator.dispose();
    }
  });
  it("rejects large retained arrays", async () => {
    const { comparator } = await loaded(
      `export default () => { const left = new Array(600_000).fill(1); const right = new Array(600_000).fill(1); return { task: 'a', reservations: [{ account: 'credit', amount: left[0] + right[0] }] }; };`,
      { timeoutMs: 500, memoryLimitMiB: 16 },
    );
    expect(comparator.evaluate(input, 1)).toMatchObject({ ok: false, failure: { kind: "memory" } });
    comparator.dispose();
  });
  it("starts each evaluation with fresh global state", async () => {
    const { comparator } = await loaded(
      `export default () => { globalThis.calls = (globalThis.calls ?? 0) + 1; return { task: 'a', reservations: [{ account: 'credit', amount: globalThis.calls }] }; };`,
    );
    for (let count = 0; count < 2; count++)
      expect(comparator.evaluate(input, 1)).toMatchObject({
        ok: true,
        selection: { task: "a", reservations: [{ account: "credit", amount: 1 }] },
      });
    comparator.dispose();
  });
  it("returns an engine failure, marks the instance spent, and permits reloading", async () => {
    const { sandbox, comparator } = await loaded();
    const badInput = {
      ...input,
      population: [
        {
          ...input.population[0]!,
          fields: {
            toJSON() {
              throw new Error("serialization failure");
            },
          },
        },
      ],
    };
    expect(comparator.evaluate(badInput, 1)).toMatchObject({
      ok: false,
      failure: { kind: "engine" },
    });
    expect(comparator.evaluate(input, 1)).toMatchObject({
      ok: false,
      failure: { kind: "engine" },
      durationMs: 0,
    });
    comparator.dispose();
    const replacement = await sandbox.load({ name: "next.ts", text: good });
    expect(replacement.ok).toBe(true);
    if (replacement.ok) {
      expect(replacement.comparator.evaluate(input, 1).ok).toBe(true);
      replacement.comparator.dispose();
    }
  });
  it("keeps an engine failure spent when its duration also exceeds the timeout", async () => {
    const { comparator } = await loaded();
    const badInput = {
      ...input,
      population: [
        {
          ...input.population[0]!,
          fields: {
            toJSON() {
              const end = performance.now() + 60;
              while (performance.now() < end) {}
              throw new Error("serialization failure");
            },
          },
        },
      ],
    };
    expect(comparator.evaluate(badInput, 1)).toMatchObject({
      ok: false,
      failure: { kind: "timeout" },
    });
    expect(comparator.evaluate(input, 1)).toMatchObject({
      ok: false,
      failure: { kind: "engine" },
      durationMs: 0,
    });
    comparator.dispose();
  });
  it("protects prelude functions from module global rebinding and does not run pending jobs", async () => {
    const { comparator } = await loaded(
      `JSON.parse = () => { throw new Error('rebound'); }; JSON.stringify = () => 'null'; Math.imul = () => 0; let task = 'a'; Promise.resolve().then(() => task = 'missing'); export default input => ({ task, reservations: [{ account: 'credit', amount: Math.ceil((input.random() + input.random()) * 100) }] });`,
    );
    expect(comparator.evaluate(input, 1234)).toMatchObject({
      ok: true,
      selection: { task: "a", reservations: [{ account: "credit", amount: 78 }] },
    });
    comparator.dispose();
  });
  it("rejects non-serializable output as invalid output", async () => {
    for (const body of [
      "return 1n;",
      'const result = { task: "a" }; result.self = result; return result;',
    ]) {
      const { comparator } = await loaded(`export default () => { ${body} };`, {
        timeoutMs: 500,
        memoryLimitMiB: 32,
      });
      expect(comparator.evaluate(input, 1)).toMatchObject({
        ok: false,
        failure: { kind: "invalid-output" },
      });
      comparator.dispose();
    }
  });
  it("lets a caller record failures and continue on the same loaded comparator", async () => {
    const { comparator } = await loaded(
      `export default input => { const mode = input.population[0].fields.mode; if (mode === 'throw') throw new Error('sample'); if (mode === 'loop') for (;;) {} if (mode === 'hoard') return new Array(16 * 1024 * 1024).fill(1); return { task: input.population[0].id }; };`,
      // The finite allocation expires at 100 ms under paired gates.
      { timeoutMs: 500, memoryLimitMiB: 16 },
    );
    const records = ["throw", "loop", "hoard", "pick"].map((mode) =>
      comparator.evaluate(
        { ...input, population: [{ ...input.population[0]!, fields: { mode } }] },
        1,
      ),
    );
    expect(records.map((record) => (record.ok ? record.selection : record.failure.kind))).toEqual([
      "thrown",
      "timeout",
      "memory",
      { task: "a" },
    ]);
    expect(records.every((record) => record.durationMs >= 0)).toBe(true);
    comparator.dispose();
  });
});
it("rejects fractional reservations under the whole-amount ledger contract", async () => {
  const { comparator } = await loaded(
    `export default () => ({task:'a',reservations:[{account:'credit',amount:0.5}]});`,
  );
  expect(comparator.evaluate(input, 1)).toMatchObject({
    ok: false,
    failure: { kind: "invalid-output" },
  });
  comparator.dispose();
});
it("rejects reservation amounts beyond the safe integer bound", async () => {
  const { comparator } = await loaded(
    `export default () => ({task:'a',reservations:[{account:'credit',amount:9007199254740992}]});`,
  );
  expect(comparator.evaluate(input, 1)).toMatchObject({
    ok: false,
    failure: { kind: "invalid-output" },
  });
  comparator.dispose();
});
