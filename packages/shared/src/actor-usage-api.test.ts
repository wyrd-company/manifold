// ---
// relationships:
//   verifies: actor-usage-api
// ---
import { expect, it } from "vite-plus/test";
import { actorUsageApiPath, isActorUsageResponse } from "./actor-usage-api.ts";
const tokens = { input: 1, output: 2, cacheRead: 3, cacheWrite: 4, reasoning: 5, total: 15 };
const usage = {
  actorId: "sample",
  tokens,
  unmetered: 1,
  accounts: [{ account: "one", actual: 7, unit: "usd" }],
  visits: [
    {
      visit: 1,
      enteredAt: "2026-01-01T00:00:00.000Z",
      tokens,
      unmetered: 1,
      accounts: [{ account: "one", actual: 7 }],
    },
  ],
  calls: [
    {
      usedAt: "2026-01-01T00:00:00.000Z",
      thread: { environment: "sample", threadId: "one" },
      visit: 1,
      total: 15,
      account: "one",
      actual: 7,
    },
    {
      usedAt: "2026-01-01T00:00:01.000Z",
      thread: { environment: "sample", threadId: "one" },
      visit: 1,
      total: null,
      account: null,
      actual: null,
    },
  ],
};
it("checks every declared response boundary and encodes one actor segment", () => {
  expect(actorUsageApiPath("task:a/b")).toBe("/api/usage/actors/task%3Aa%2Fb");
  expect(isActorUsageResponse(usage)).toBe(true);
  for (const value of [
    null,
    { ...usage, extra: true },
    (({ unmetered: _unmetered, ...value }) => value)(usage),
    { ...usage, unmetered: -1 },
    { ...usage, tokens: { ...tokens, total: -1 } },
    { ...usage, accounts: [{ account: "one", actual: "7" }] },
    { ...usage, visits: [{ ...usage.visits[0], visit: 0 }] },
    { ...usage, visits: [{ ...usage.visits[0], unmetered: -1 }] },
    { ...usage, calls: [{ ...usage.calls[0], thread: { environment: "sample", threadId: 1 } }] },
    { ...usage, calls: [{ ...usage.calls[0], usedAt: "2026-02-30T00:00:00.000Z" }] },
  ])
    expect(isActorUsageResponse(value)).toBe(false);
});
