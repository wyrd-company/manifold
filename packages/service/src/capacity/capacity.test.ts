// ---
// relationships:
//   verifies: portfolio
// ---
import { afterEach, expect, test } from "vite-plus/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../store/index.ts";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio } from "../ledger/index.ts";
import { openCapacity } from "./index.ts";
import type { CapacityAccount } from "./index.ts";
const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0).toReversed()) close();
});
const reset = Date.parse("2026-01-01T00:00:00Z");
const hour = 3600000;
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "capacity-"));
  cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, "store.sqlite");
  const store = openStore({ path });
  cleanup.push(() => store.close());
  store.connection.migrate("ledger", ledgerMigrationSteps);
  let now = reset + hour / 6;
  let account: CapacityAccount = {
    kind: "api",
    capacity: { amount: 1, reset: new Date(reset).toISOString(), every: { hours: 1 } },
  };
  const portfolio = parseLedgerPortfolio({
    items: [
      { id: "alpha", parent: null },
      { id: "beta", parent: null },
    ],
    allocations: [
      { item: "alpha", account: "acct", guarantee: 50 },
      { item: "beta", account: "acct", guarantee: 50 },
    ],
  });
  const ledger = createLedger({ connection: store.connection, portfolio, now: () => now });
  let followed = 0;
  const capacity = openCapacity({
    connection: store.connection,
    ledger,
    accounts: () => ({ acct: account }),
    now: () => now,
    credited: () => {},
    followUp: () => {
      followed++;
    },
  });
  cleanup.push(capacity.close);
  const balance = () => capacity.ledger.balance({ item: "alpha", account: "acct", waiting: [] });
  const credits = () =>
    store.connection.database.prepare("SELECT * FROM ledger_entries WHERE kind = 'credit'").all();
  return {
    store,
    path,
    portfolio,
    ledger,
    capacity,
    balance,
    credits,
    account: (next: CapacityAccount) => {
      account = next;
    },
    time: (at: number) => {
      now = at;
    },
    followed: () => followed,
  };
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
test("credits the current window once and coalesces reset follow-up", async () => {
  const f = fixture();
  expect(f.balance()).toMatchObject({ allocation: 500000, window: new Date(reset).toISOString() });
  f.balance();
  expect(f.credits()).toHaveLength(1);
  expect(
    f.store.connection.database
      .prepare("SELECT key FROM ledger_operations WHERE kind = 'credit'")
      .get(),
  ).toMatchObject({ key: "capacity:acct:2026-01-01T00:00:00.000Z" });
  f.time(reset + hour + 1);
  expect(f.balance().allocation).toBe(500000);
  await tick();
  expect(f.credits()).toHaveLength(2);
  expect(f.followed()).toBe(1);
});
test("keeps credited capacity and clips a changed series to neighbouring windows", () => {
  const f = fixture();
  f.balance();
  f.account({
    kind: "api",
    capacity: { amount: 2, reset: new Date(reset).toISOString(), every: { hours: 1 } },
  });
  expect(f.balance().allocation).toBe(500000);
  f.time(reset + hour + 1);
  expect(f.balance().allocation).toBe(1000000);
  f.account({
    kind: "subscription",
    capacity: { amount: 1, reset: new Date(reset + 3.5 * hour).toISOString(), every: { hours: 2 } },
  });
  f.time(reset + 2.1 * hour);
  expect(f.balance().allocation).toBe(375000);
  expect(f.credits()[2]).toMatchObject({ amount: 750000 });
});
test("rolls back credit with a failing standalone reserve or caller transaction", () => {
  const f = fixture();
  const reserve = (item: string) =>
    f.capacity.ledger.reserve({ key: "hold", actor: "actor", item, account: "acct", amount: 1 });
  expect(() => reserve("missing")).toThrow();
  expect(f.credits()).toHaveLength(0);
  expect(() =>
    f.store.connection.transaction(() => {
      reserve("alpha");
      throw new Error("abort");
    }),
  ).toThrow("abort");
  expect(f.credits()).toHaveLength(0);
  reserve("alpha");
  expect(f.credits()).toHaveLength(1);
});
test("serializes credits across two connections", () => {
  const f = fixture();
  const second = openStore({ path: f.path });
  cleanup.push(() => second.close());
  const other = openCapacity({
    connection: second.connection,
    ledger: createLedger({ connection: second.connection, portfolio: f.portfolio }),
    accounts: () => ({
      acct: {
        kind: "api",
        capacity: { amount: 2, reset: new Date(reset).toISOString(), every: { hours: 1 } },
      },
    }),
    credited: () => {},
    followUp: () => {},
  });
  cleanup.push(other.close);
  f.store.connection.transaction(() => {
    f.capacity.ensure({ account: "acct", at: reset });
    expect(() => other.ensure({ account: "acct", at: reset })).toThrow();
  });
  expect(other.ensure({ account: "acct", at: reset })).toMatchObject({ status: "covered" });
  expect(f.credits()).toHaveLength(1);
  expect(f.credits()[0]).toMatchObject({ amount: 1000000 });
});
test("refuses uncovered actuals including times after a stale window and credits asynchronously", async () => {
  const f = fixture();
  f.balance();
  const request = {
    key: "call",
    actor: "actor",
    item: "alpha",
    account: "acct",
    amount: 10,
    usedAt: reset + hour + 1,
  };
  expect(() => f.capacity.ledger.postActual(request)).toThrow(
    expect.objectContaining({ code: "no-window" }),
  );
  await tick();
  f.capacity.ledger.postActual(request);
  f.capacity.ledger.postActual(request);
  expect(f.ledger.actorUsage("actor").accounts[0]?.actual).toBe(10);
  expect(
    f.store.connection.database
      .prepare("SELECT window_key FROM ledger_entries WHERE kind = 'actual'")
      .get(),
  ).toMatchObject({ window_key: new Date(reset + hour).toISOString() });
});
test("credits past windows and leaves undeclared and out-of-range accounts alone", () => {
  const f = fixture();
  expect(f.capacity.ensure({ account: "acct", at: reset - 3 * hour })).toMatchObject({
    status: "credited",
    credit: { opensAt: reset - 3 * hour },
  });
  expect(f.capacity.ensure({ account: "acct", at: reset - 3 * hour })).toMatchObject({
    status: "covered",
  });
  expect(f.capacity.ensure({ account: "absent", at: reset })).toEqual({ status: "undeclared" });
  expect(f.capacity.ensure({ account: "acct", at: Date.parse("9995-01-01") })).toEqual({
    status: "out-of-range",
  });
  expect(
    f.capacity.ledger.balance({ item: "alpha", account: "absent", waiting: [] }).allocation,
  ).toBe(0);
  expect(f.credits()).toHaveLength(1);
});

test.each([
  [{ hours: 1 }, "2026-01-01T00:00:00Z", "2025-12-31T23:00:00.000Z", "2026-01-01T00:00:00.000Z"],
  [
    { days: 1 },
    "2026-01-01T01:00:00+01:00",
    "2025-12-31T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
  ],
  [{ months: 1 }, "2026-01-28T00:00:00Z", "2025-12-28T00:00:00.000Z", "2026-01-28T00:00:00.000Z"],
] as const)("computes series before, at, and after reset %s", (every, anchor, before, after) => {
  const f = fixture();
  f.account({ kind: "api", capacity: { amount: 1, reset: anchor, every } });
  const at = Date.parse(anchor);
  expect(f.capacity.ensure({ account: "acct", at: at - 1 })).toMatchObject({
    status: "credited",
    credit: { window: before },
  });
  expect(f.capacity.ensure({ account: "acct", at })).toMatchObject({
    status: "credited",
    credit: { window: after },
  });
  expect(f.capacity.ensure({ account: "acct", at: at + 1 })).toMatchObject({
    status: "covered",
    window: after,
  });
});
test("uses calendar months through the 28th and clips against a future window", () => {
  const f = fixture();
  f.account({
    kind: "api",
    capacity: { amount: 1, reset: "2026-01-28T00:00:00Z", every: { months: 1 } },
  });
  expect(f.capacity.ensure({ account: "acct", at: Date.parse("2026-03-01") })).toMatchObject({
    credit: { opensAt: Date.parse("2026-02-28"), closesAt: Date.parse("2026-03-28") },
  });
  f.account({
    kind: "api",
    capacity: { amount: 1, reset: "2026-01-01T00:00:00Z", every: { months: 2 } },
  });
  expect(f.capacity.ensure({ account: "acct", at: Date.parse("2026-02-01") })).toMatchObject({
    credit: {
      opensAt: Date.parse("2026-01-01"),
      closesAt: Date.parse("2026-02-28"),
      amount: Math.floor((1000000 * 58) / 59),
    },
  });
});
test.each([{ hours: 87600 }, { days: 3650 }, { months: 120 }])(
  "keeps maximum length boundaries in four-digit years: %s",
  (every) => {
    const f = fixture();
    f.account({ kind: "api", capacity: { amount: 1, reset: "0001-01-01T00:00:00Z", every } });
    for (const at of ["0011-01-01T00:00:00.000Z", "9989-12-31T23:59:59.999Z"]) {
      const result = f.capacity.ensure({ account: "acct", at: Date.parse(at) });
      expect(result.status).toBe("credited");
      if (result.status === "credited") {
        expect(result.credit.window).toMatch(/^\d{4}-/);
        expect(result.credit.closesAt).toBeLessThanOrEqual(Date.parse("9999-12-31T23:59:59.999Z"));
      }
    }
  },
);
test("cancels a scheduled actual credit at close", async () => {
  const f = fixture();
  expect(() =>
    f.capacity.ledger.postActual({
      key: "call",
      actor: "actor",
      item: "alpha",
      account: "acct",
      amount: 1,
      usedAt: reset,
    }),
  ).toThrow();
  f.capacity.close();
  await tick();
  expect(f.credits()).toHaveLength(0);
});

test("reads neighbouring ledger windows and all their credits without writing", () => {
  const f = fixture();
  f.ledger.credit({
    key: "one",
    account: "acct",
    window: "first",
    opensAt: reset,
    closesAt: reset + hour,
    amount: 100,
  });
  f.ledger.credit({
    key: "two",
    account: "acct",
    window: "first",
    opensAt: reset,
    closesAt: reset + hour,
    amount: 200,
  });
  f.ledger.credit({
    key: "three",
    account: "acct",
    window: "next",
    opensAt: reset + 2 * hour,
    closesAt: reset + 3 * hour,
    amount: 400,
  });
  expect(f.ledger.windowAt({ account: "acct", at: reset + hour })).toEqual({
    current: { window: "first", opensAt: reset, closesAt: reset + hour, capacity: 300 },
    next: { window: "next", opensAt: reset + 2 * hour, closesAt: reset + 3 * hour, capacity: 400 },
  });
  expect(f.ledger.windowAt({ account: "acct", at: reset - 1 }).current).toBeNull();
  expect(f.ledger.windowAt({ account: "acct", at: reset + 2 * hour }).next).toBeNull();
  expect(f.credits()).toHaveLength(3);
});

test.each([
  NaN,
  Infinity,
  1.5,
  Date.parse("0001-06-01T00:00:00Z"),
  Date.parse("9995-01-01T00:00:00Z"),
])("returns out-of-range without touching windows for %s", (at) => {
  const f = fixture();
  expect(f.capacity.ensure({ account: "acct", at })).toEqual({ status: "out-of-range" });
  expect(f.credits()).toHaveLength(0);
});
test("credits at least one millionth in a clipped gap", () => {
  const f = fixture();
  f.ledger.credit({
    key: "prior",
    account: "acct",
    window: "prior",
    opensAt: reset - hour,
    closesAt: reset + hour - 1,
    amount: 1,
  });
  f.account({
    kind: "api",
    capacity: { amount: 0.000001, reset: new Date(reset).toISOString(), every: { hours: 1 } },
  });
  expect(f.capacity.ensure({ account: "acct", at: reset + hour - 1 })).toMatchObject({
    status: "credited",
    credit: { opensAt: reset + hour - 1, closesAt: reset + hour, amount: 1 },
  });
});
