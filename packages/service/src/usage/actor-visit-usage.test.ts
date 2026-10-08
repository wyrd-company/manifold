// ---
// relationships:
//   verifies: [actor-usage-api, usage-intake]
// ---
import { expect, it } from "vite-plus/test";
import { visitUsage } from "./actor-visit-usage.ts";
const tokens = { input: 10, output: 5, cacheRead: 2, cacheWrite: 3, reasoning: 4 };
it("sums sparse visits, pending tokens and provider totals, listing each posting once", () => {
  const rows = [
    {
      seq: 1,
      provider: "codex",
      tokens: JSON.stringify(tokens),
      visit: 2,
      account: "second",
      amount: 7,
      status: "posted",
      used_at: 10,
      environment: "sample",
      thread_id: "thread-a",
    },
    {
      seq: 2,
      provider: "claude",
      tokens: JSON.stringify(tokens),
      visit: 4,
      account: "first",
      amount: 9,
      status: "posted",
      used_at: 20,
      environment: "sample",
      thread_id: "thread-a",
    },
    {
      seq: 3,
      provider: "claude",
      tokens: JSON.stringify(tokens),
      visit: null,
      account: "unpriced",
      amount: null,
      status: "pending",
      used_at: 30,
      environment: "sample",
      thread_id: null,
    },
  ];
  const result = visitUsage(
    "actor-a",
    rows,
    [
      { visit: 2, entered_at: 5 },
      { visit: 4, entered_at: 15 },
    ],
    { first: "usd" },
  );
  expect(visitUsage("actor-a", rows.toReversed(), [], {}).calls).toEqual(result.calls);
  expect(result.tokens).toEqual({
    input: 30,
    output: 15,
    cacheRead: 6,
    cacheWrite: 9,
    reasoning: 12,
    total: 68,
  });
  expect(result.accounts).toEqual([
    { account: "first", actual: 9, unit: "usd" },
    { account: "second", actual: 7 },
  ]);
  expect(result.visits.map((v) => [v.visit, v.tokens.total])).toEqual([
    [2, 20],
    [4, 24],
  ]);
  expect(result.calls.map((c) => [c.total, c.thread, c.actual])).toEqual([
    [20, { environment: "sample", threadId: "thread-a" }, 7],
    [24, { environment: "sample", threadId: "thread-a" }, 9],
    [24, null, null],
  ]);
});
