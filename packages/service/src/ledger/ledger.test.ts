// ---
// relationships:
//   verifies: portfolio-ledger
//   references: portfolio-ledger-tables
// ---
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createLedger, ledgerMigrationSteps, parseLedgerPortfolio, LedgerError } from "./index.js";
import type { LedgerPortfolioInput } from "./index.js";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const close of cleanup.splice(0)) close();
});
const split = (a = 50, b = 50): LedgerPortfolioInput => ({
  items: [
    { id: "alpha", parent: null },
    { id: "beta", parent: null },
  ],
  allocations: [
    { item: "alpha", account: "acct", guarantee: a },
    { item: "beta", account: "acct", guarantee: b },
  ],
});
function setup(input = split(), credited = true) {
  const dir = mkdtempSync(join(tmpdir(), "ledger-test-"));
  const path = join(dir, "test.sqlite");
  const database = new DatabaseSync(path);
  cleanup.push(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });
  for (const step of ledgerMigrationSteps) database.exec(step);
  let depth = 0;
  const connection = {
    database,
    transaction<T>(work: () => T): T {
      const nested = depth++;
      database.exec(nested ? `SAVEPOINT ledger_test_${nested}` : "BEGIN IMMEDIATE");
      try {
        const result = work();
        database.exec(nested ? `RELEASE ledger_test_${nested}` : "COMMIT");
        return result;
      } catch (error) {
        database.exec(nested ? `ROLLBACK TO ledger_test_${nested}` : "ROLLBACK");
        if (nested) database.exec(`RELEASE ledger_test_${nested}`);
        throw error;
      } finally {
        depth--;
      }
    },
  };
  let time = 0;
  const portfolio = parseLedgerPortfolio(input);
  const ledger = createLedger({ connection, portfolio, now: () => time });
  const credit = (key = "credit-1", window = "w1", opensAt = 0, amount = 100) =>
    ledger.credit({ key, account: "acct", window, opensAt, closesAt: opensAt + 1000, amount });
  if (credited) credit();
  let key = 0;
  const reserve = (amount: number, item = "alpha", actor = "actor-1", operation = `r-${++key}`) =>
    ledger.reserve({ key: operation, actor, item, account: "acct", amount });
  const actual = (
    amount: number,
    item = "alpha",
    actor = "actor-1",
    usedAt = time,
    operation = `a-${++key}`,
  ) => ledger.postActual({ key: operation, actor, item, account: "acct", amount, usedAt });
  const balance = (item = "alpha", waiting: string[] = []) =>
    ledger.balance({ item, account: "acct", waiting });
  const move = (
    actor = "actor-1",
    operation = `m-${++key}`,
    from = "alpha",
    to = "beta",
    waiting: string[] = [],
  ) => ledger.move({ key: operation, actor, account: "acct", from, to, waiting });
  return {
    ledger,
    database,
    connection,
    path,
    portfolio,
    credit,
    reserve,
    actual,
    balance,
    move,
    time: (value: number) => {
      time = value;
    },
  };
}
function errorCode(work: () => unknown, code: string) {
  expect(work).toThrow(LedgerError);
  try {
    work();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe("portfolio ledger", () => {
  it.each(["ledger_entries", "ledger_operations", "ledger_windows", "ledger_settlements"])(
    "rejects update and delete on populated %s",
    (table) => {
      const s = setup();
      s.reserve(20);
      s.actual(12);
      s.ledger.settle({ actor: "actor-1" });
      const column =
        table === "ledger_entries"
          ? "amount"
          : table === "ledger_operations"
            ? "key"
            : table === "ledger_windows"
              ? "account"
              : "actor";
      const before = s.database.prepare(`SELECT * FROM ${table}`).all();
      expect(before.length).toBeGreaterThan(0);
      expect(() => s.database.exec(`UPDATE ${table} SET ${column} = ${column}`)).toThrow(
        `${table} is append-only`,
      );
      expect(() => s.database.exec(`DELETE FROM ${table}`)).toThrow(`${table} is append-only`);
      expect(s.database.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
    },
  );

  it("makes room for a move when the account is fully committed", () => {
    const s = setup();
    s.actual(20);
    s.reserve(80, "alpha", "actor-2");
    s.ledger.setPortfolio(parseLedgerPortfolio(split(0, 100)));
    expect(s.balance("beta").reservable).toBe(0);
    expect(s.move("actor-2")).toEqual({ moved: true, amount: 80, replayed: false });
    expect(s.balance("beta")).toMatchObject({ outstanding: 80, reservable: 0 });
  });
  it("charges removed usage before dividing remainder among waiting items", () => {
    const s = setup(split(30, 30));
    s.actual(30, "removed");
    expect(s.balance("alpha", ["alpha", "beta"]).reservable).toBe(35);
    expect(s.balance("beta", ["alpha", "beta"]).reservable).toBe(35);
  });

  it("replays accepted writes after restart, settlement, and portfolio removal", () => {
    const s = setup();
    s.reserve(30, "alpha", "actor-1", "original");
    const request = {
      key: "move-replay",
      actor: "actor-1",
      account: "acct",
      from: "alpha",
      to: "beta",
      waiting: ["alpha", "beta"],
    };
    expect(s.ledger.move(request)).toMatchObject({ moved: true, amount: 30, replayed: false });
    s.ledger.settle({ actor: "actor-1" });
    const portfolio = parseLedgerPortfolio({ items: [], allocations: [] });
    s.ledger.setPortfolio(portfolio);
    expect(s.reserve(30, "alpha", "actor-1", "original")).toEqual({ replayed: true });
    const database = new DatabaseSync(s.path);
    cleanup.push(() => database.close());
    const ledger = createLedger({
      connection: { database, transaction: (work) => work() },
      portfolio,
      now: () => 1000,
    });
    expect(ledger.move({ ...request, waiting: ["beta", "alpha"] })).toEqual({
      moved: true,
      amount: 30,
      replayed: true,
    });
    expect(ledger.actorUsage("actor-1")).toMatchObject({
      settled: true,
      accounts: [{ estimate: 30, actual: 0, outstanding: 0 }],
    });
  });
  it("rolls back every row of a failed write, including a partially inserted move", () => {
    const s = setup();
    s.database.exec(
      "CREATE TRIGGER fail_move BEFORE INSERT ON ledger_entries WHEN NEW.kind = 'move' AND NEW.amount > 0 BEGIN SELECT RAISE(ABORT, 'injected failure'); END",
    );
    s.reserve(30);
    expect(() => s.move("actor-1", "retry-move")).toThrow("injected failure");
    expect(s.balance().outstanding).toBe(30);
    expect(s.balance("beta").outstanding).toBe(0);
    expect(
      s.database.prepare("SELECT * FROM ledger_operations WHERE key = ?").get("retry-move"),
    ).toBeUndefined();
    s.database.exec("DROP TRIGGER fail_move");
    expect(s.move("actor-1", "retry-move")).toMatchObject({
      moved: true,
      amount: 30,
      replayed: false,
    });
  });
  it("settles across accounts and items while isolating capacity and usage", () => {
    const input = split();
    input.allocations.push({ item: "alpha", account: "other", guarantee: 100 });
    const s = setup(input);
    s.ledger.credit({
      key: "other-credit",
      account: "other",
      window: "w1",
      opensAt: 0,
      closesAt: 1000,
      amount: 200,
    });
    s.reserve(20);
    s.reserve(10, "beta");
    s.ledger.reserve({
      key: "other-reserve",
      account: "other",
      actor: "actor-1",
      item: "alpha",
      amount: 100,
    });
    s.actual(5);
    expect(s.balance().outstanding).toBe(15);
    expect(s.ledger.balance({ item: "alpha", account: "other", waiting: [] })).toMatchObject({
      actual: 0,
      outstanding: 100,
      available: 100,
    });
    expect(s.ledger.settle({ actor: "actor-1" }).retired).toHaveLength(3);
    expect(s.ledger.actorUsage("actor-1").accounts).toEqual([
      { account: "acct", estimate: 30, actual: 5, variance: -25, outstanding: 0 },
      { account: "other", estimate: 100, actual: 0, variance: -100, outstanding: 0 },
    ]);
  });
  it("uses default allocations and excludes unknown and archived waiting items", () => {
    const input = split(30, 30);
    input.items.push({ id: "gamma", parent: null, archived: true });
    const s = setup(input);
    expect(s.balance("alpha", ["missing", "gamma"]).reservable).toBe(70);
    expect(s.balance("gamma")).toMatchObject({ allocation: 0, reservable: 0 });
    const portfolio = parseLedgerPortfolio({
      items: [{ id: "alpha", parent: null }],
      allocations: [],
    });
    s.ledger.setPortfolio(portfolio);
    expect(s.balance()).toMatchObject({ allocation: 0, available: 0, reservable: 100 });
    input.allocations[0]!.guarantee = 100;
    expect(s.balance().allocation).toBe(0);
  });
  it("clamps pacing at either end and bounds a child by parent pacing", () => {
    const s = setup({
      items: [
        { id: "alpha", parent: null },
        { id: "beta", parent: "alpha" },
      ],
      allocations: [
        { item: "alpha", account: "acct", guarantee: 100, pacing: { burst: 0 } },
        { item: "beta", account: "acct", guarantee: 100 },
      ],
    });
    expect(s.balance("beta").reservable).toBe(0);
    s.time(500);
    expect(s.balance("beta").reservable).toBe(50);
    s.time(2000);
    expect(s.balance("beta").reservable).toBe(100);
    s.actual(110, "beta");
    expect(s.balance("beta")).toMatchObject({ available: -10, reservable: 0 });
  });

  it("replays a reserve once and refuses cross-kind or changed requests", () => {
    const s = setup();
    expect(s.reserve(30, "alpha", "actor-1", "k1")).toEqual({ replayed: false });
    expect(s.reserve(30, "alpha", "actor-1", "k1")).toEqual({ replayed: true });
    expect(s.balance().available).toBe(20);
    expect(s.ledger.actorUsage("actor-1").accounts[0]?.estimate).toBe(30);
    errorCode(() => s.reserve(31, "alpha", "actor-1", "k1"), "idempotency-conflict");
    errorCode(() => s.actual(30, "beta", "actor-2", 0, "k1"), "idempotency-conflict");
    s.ledger.settle({ actor: "actor-1" });
    s.ledger.setPortfolio(parseLedgerPortfolio(split(0, 100)));
    expect(s.reserve(30, "alpha", "actor-1", "k1")).toEqual({ replayed: true });
  });
  it("counts arriving usage against the hold and retains actuals at settlement", () => {
    const s = setup();
    s.reserve(20);
    expect(s.balance().available).toBe(30);
    s.actual(12);
    expect(s.balance()).toMatchObject({ available: 30, outstanding: 8, actual: 12 });
    s.actual(15);
    expect(s.balance().available).toBe(23);
    expect(s.ledger.settle({ actor: "actor-1" })).toEqual({
      retired: [{ item: "alpha", account: "acct", amount: 20 }],
    });
    expect(s.balance()).toMatchObject({ available: 23, outstanding: 0 });
    expect(s.ledger.actorUsage("actor-1")).toEqual({
      settled: true,
      accounts: [{ account: "acct", estimate: 20, actual: 27, variance: 7, outstanding: 0 }],
    });
    expect(s.ledger.settle({ actor: "actor-1" })).toEqual({ retired: [] });
    errorCode(() => s.reserve(1), "actor-settled");
    s.actual(5);
    expect(s.balance().available).toBe(18);
  });
  it("settles the net estimate rather than only the unconsumed hold", () => {
    const s = setup();
    s.reserve(20);
    s.actual(12);
    s.ledger.settle({ actor: "actor-1" });
    expect(s.ledger.actorUsage("actor-1").accounts[0]).toMatchObject({
      variance: -8,
      actual: 12,
      outstanding: 0,
    });
  });
  it("keeps a fixed split and lets reserve record the comparator's decision", () => {
    const s = setup();
    expect(s.balance().reservable).toBe(50);
    s.reserve(50);
    expect(s.balance().reservable).toBe(0);
    expect(s.balance("beta").reservable).toBe(50);
    s.reserve(10);
    expect(s.balance().available).toBe(-10);
  });
  it("borrows only unallocated remainder, respects ceilings and waiting weights", () => {
    const s = setup(split(30, 30));
    expect(s.balance().reservable).toBe(70);
    s.reserve(70);
    expect(s.balance("beta").reservable).toBe(30);
    expect(s.balance().reservable).toBe(0);
    const input = split(30, 30);
    input.allocations[0]!.ceiling = 50;
    expect(setup(input).balance().reservable).toBe(50);
    input.allocations[0]!.ceiling = 100;
    input.allocations[1]!.weight = 3;
    const weighted = setup(input);
    expect(weighted.balance("alpha", ["alpha", "beta", "beta"]).reservable).toBe(40);
    expect(weighted.balance("beta", ["alpha", "beta"]).reservable).toBe(60);
    expect(weighted.balance().reservable).toBe(70);
  });
  it("paces capacity and restarts pacing at a reset", () => {
    const input = split(50, 30);
    input.allocations[0]!.pacing = { burst: 10 };
    const s = setup(input);
    expect(s.balance().reservable).toBe(10);
    s.time(500);
    expect(s.balance().reservable).toBe(35);
    s.time(900);
    expect(s.balance().reservable).toBe(55);
    s.time(2000);
    expect(s.balance().reservable).toBe(60);
    s.credit("credit-2", "w2", 1000);
    s.time(1000);
    expect(s.balance().reservable).toBe(10);
  });
  it("passes borrowed room down the tree and weights waiting descendants", () => {
    const s = setup({
      items: [
        { id: "alpha", parent: null },
        { id: "beta", parent: "alpha" },
        { id: "gamma", parent: "alpha" },
      ],
      allocations: [
        { item: "alpha", account: "acct", guarantee: 60, ceiling: 80 },
        { item: "beta", account: "acct", guarantee: 50 },
        { item: "gamma", account: "acct", guarantee: 50 },
      ],
    });
    expect(s.balance("gamma").reservable).toBe(50);
    expect(s.balance("gamma", ["beta", "gamma"]).reservable).toBe(40);
    expect(s.balance("beta", ["beta", "gamma"]).reservable).toBe(40);
    s.reserve(40, "beta");
    expect(s.balance("alpha")).toMatchObject({ actual: 0, outstanding: 40, allocation: 60 });
  });
  it("refuses an unaffordable move without recording its key, then retries", () => {
    const s = setup();
    s.reserve(30);
    s.actual(18);
    s.reserve(45, "beta", "actor-2");
    const before = s.database.prepare("SELECT count(*) AS n FROM ledger_operations").get();
    expect(s.move("actor-1", "move-1")).toEqual({ moved: false, amount: 12, reservable: 5 });
    expect(s.database.prepare("SELECT count(*) AS n FROM ledger_operations").get()).toEqual(before);
    s.ledger.settle({ actor: "actor-2" });
    s.reserve(30, "beta", "actor-3");
    expect(s.move("actor-1", "move-1")).toEqual({ moved: true, amount: 12, replayed: false });
    expect(s.move("actor-1", "move-1")).toEqual({ moved: true, amount: 12, replayed: true });
    expect(s.balance()).toMatchObject({ actual: 18, outstanding: 0 });
    expect(s.balance("beta").outstanding).toBe(42);
    expect(s.ledger.actorUsage("actor-1").accounts[0]?.estimate).toBe(30);
    errorCode(() => s.move("actor-1", "move-1", "beta", "alpha"), "idempotency-conflict");
  });
  it("moves a whole hold onto prior actuals and settles cancelling entries", () => {
    const s = setup();
    s.actual(20, "beta");
    s.reserve(30);
    s.actual(18);
    expect(s.move()).toMatchObject({ moved: true, amount: 12 });
    expect(s.balance("beta")).toMatchObject({ actual: 20, outstanding: 12 });
    expect(s.ledger.actorUsage("actor-1").accounts[0]?.outstanding).toBe(12);
    expect(
      s.ledger.settle({ actor: "actor-1" }).retired.sort((a, b) => a.item.localeCompare(b.item)),
    ).toEqual([
      { item: "alpha", account: "acct", amount: 18 },
      { item: "beta", account: "acct", amount: 12 },
    ]);
    expect(s.balance("beta")).toMatchObject({ actual: 20, outstanding: 0 });
  });
  it("retains archived and removed usage, late actuals, and restarts", () => {
    const s = setup();
    s.actual(20);
    s.reserve(10, "alpha", "actor-2");
    s.ledger.setPortfolio(
      parseLedgerPortfolio({
        items: [
          { id: "alpha", parent: null, archived: true },
          { id: "beta", parent: null },
        ],
        allocations: [{ item: "beta", account: "acct", guarantee: 50 }],
      }),
    );
    expect(s.balance("beta").reservable).toBe(70);
    errorCode(() => s.reserve(1), "invalid-input");
    errorCode(() => s.move("actor-2", "bad-move", "beta", "alpha"), "invalid-input");
    s.ledger.settle({ actor: "actor-2" });
    expect(s.balance("beta").reservable).toBe(80);
    const portfolio = parseLedgerPortfolio({
      items: [{ id: "beta", parent: null }],
      allocations: [{ item: "beta", account: "acct", guarantee: 50 }],
    });
    s.ledger.setPortfolio(portfolio);
    expect(s.balance("beta").reservable).toBe(80);
    s.actual(5);
    expect(s.balance("beta").reservable).toBe(75);
    const database = new DatabaseSync(s.path);
    cleanup.push(() => database.close());
    const restarted = createLedger({
      connection: { database, transaction: s.connection.transaction },
      portfolio,
      now: () => 0,
    });
    expect(restarted.balance({ item: "beta", account: "acct", waiting: [] })).toEqual(
      s.balance("beta"),
    );
    expect(restarted.actorUsage("actor-1")).toEqual(s.ledger.actorUsage("actor-1"));
  });
  it.each(["archive", "drop", "live"])(
    "caps reservable after %s reallocation by all account usage",
    (mode) => {
      const s = setup();
      s.actual(20);
      const input = split(0, 100);
      if (mode === "archive") {
        input.items[0]!.archived = true;
        input.allocations.shift();
      }
      if (mode === "drop") {
        input.items.shift();
        input.allocations.shift();
      }
      s.ledger.setPortfolio(parseLedgerPortfolio(input));
      expect(s.balance("beta")).toMatchObject({ allocation: 100, available: 100, reservable: 80 });
      s.reserve(80, "beta", "actor-2");
      expect(s.balance("beta")).toMatchObject({ available: 20, reservable: 0 });
      s.credit("credit-2", "w2", 1000);
      s.time(1000);
      s.ledger.settle({ actor: "actor-2" });
      expect(s.balance("beta").reservable).toBe(100);
    },
  );
  it("charges archived descendants to their parent after nested reallocation", () => {
    const input: LedgerPortfolioInput = {
      items: [
        { id: "alpha", parent: null },
        { id: "beta", parent: "alpha" },
        { id: "gamma", parent: "alpha" },
      ],
      allocations: [
        { item: "alpha", account: "acct", guarantee: 100 },
        { item: "beta", account: "acct", guarantee: 50 },
        { item: "gamma", account: "acct", guarantee: 50 },
      ],
    };
    const s = setup(input);
    s.actual(20, "gamma");
    input.items[2]!.archived = true;
    input.allocations.pop();
    input.allocations[1]!.guarantee = 100;
    s.ledger.setPortfolio(parseLedgerPortfolio(input));
    expect(s.balance("alpha").reservable).toBe(80);
    expect(s.balance("beta").reservable).toBe(80);
    s.actual(10, "gamma");
    expect(s.balance("alpha").reservable).toBe(70);
    expect(s.balance("beta").reservable).toBe(70);
  });
  it("provisionally removes the source hold for a move under live reallocation", () => {
    const s = setup();
    s.actual(20);
    s.reserve(30, "alpha", "actor-2");
    s.ledger.setPortfolio(parseLedgerPortfolio(split(0, 100)));
    expect(s.balance().reservable).toBe(0);
    expect(s.move("actor-2")).toMatchObject({ moved: true, amount: 30 });
    expect(s.balance("beta").reservable).toBe(50);
    s.reserve(50, "beta", "actor-3");
    expect(s.move()).toMatchObject({ moved: true, amount: 0 });
    expect(s.balance("beta").reservable).toBe(0);
  });
  it("carries outstanding holds across windows and attributes late usage by usedAt", () => {
    const s = setup();
    s.reserve(40);
    s.actual(30);
    s.credit("credit-2", "w2", 1000);
    s.time(1000);
    expect(s.balance()).toMatchObject({ window: "w2", actual: 0, outstanding: 10, available: 40 });
    s.actual(10, "alpha", "actor-1", 1000);
    expect(s.balance()).toMatchObject({ actual: 10, outstanding: 0, available: 40 });
    s.actual(5, "alpha", "actor-1", 900);
    expect(s.balance().actual).toBe(10);
    s.time(900);
    expect(s.balance()).toMatchObject({ window: "w1", actual: 35 });
  });
  it("selects windows by opening time, validates credit conflicts, and replays credits and actuals", () => {
    const s = setup(split(), false);
    expect(s.balance()).toEqual({
      window: null,
      allocation: 0,
      actual: 0,
      outstanding: 0,
      available: 0,
      reservable: 0,
    });
    errorCode(() => s.reserve(1), "no-window");
    errorCode(() => s.actual(1), "no-window");
    expect(s.credit()).toEqual({ replayed: false });
    expect(s.credit()).toEqual({ replayed: true });
    s.credit("credit-more", "w1", 0, 20);
    expect(s.balance().allocation).toBe(60);
    errorCode(() => s.credit("conflict", "w1", 1), "window-conflict");
    errorCode(() => s.credit("conflict", "other", 0), "window-conflict");
    errorCode(() => s.actual(1, "alpha", "actor-1", -1), "no-window");
    expect(s.actual(5, "alpha", "actor-1", 0, "actual-1")).toEqual({ replayed: false });
    expect(s.actual(5, "alpha", "actor-1", 0, "actual-1")).toEqual({ replayed: true });
    s.time(2000);
    expect(s.balance().window).toBe("w1");
  });
  it("does not let actuals posted before a reservation consume a later hold", () => {
    const s = setup();
    s.actual(20);
    s.reserve(30);
    expect(s.balance()).toMatchObject({ actual: 20, outstanding: 30, available: 0 });
  });
  it("rolls back ledger writes with caller work and retries the same key", () => {
    const s = setup();
    expect(() =>
      s.connection.transaction(() => {
        s.reserve(30, "alpha", "actor-1", "retry");
        throw new Error("abort");
      }),
    ).toThrow("abort");
    expect(s.balance().outstanding).toBe(0);
    expect(s.reserve(30, "alpha", "actor-1", "retry")).toEqual({ replayed: false });
    expect(() =>
      s.connection.transaction(() => {
        s.move("actor-1", "move-abort");
        s.ledger.settle({ actor: "actor-1" });
        throw new Error("abort");
      }),
    ).toThrow("abort");
    expect(s.ledger.actorUsage("actor-1")).toMatchObject({
      settled: false,
      accounts: [{ outstanding: 30 }],
    });
  });
  it("enforces every entry kind's sign and attribution constraints", () => {
    const s = setup();
    const insert = s.database.prepare(
      "INSERT INTO ledger_entries (kind, operation, account, window_key, item, actor, amount, at) VALUES (?, ?, 'acct', ?, ?, ?, ?, 0)",
    );
    const invalidRows: [
      string,
      string | null,
      string | null,
      string | null,
      string | null,
      number,
    ][] = [
      ["credit", "k", "w1", null, "actor-1", 1],
      ["credit", "k", "w1", "alpha", null, 1],
      ["credit", "k", "w1", null, null, 0],
      ["actual", "k", null, "alpha", "actor-1", 1],
      ["actual", "k", "w1", "alpha", "actor-1", -1],
      ["reserve", "k", "w1", "alpha", "actor-1", 1],
      ["reserve", "k", null, "alpha", "actor-1", 0],
      ["settle", null, null, "alpha", "actor-1", 0],
      ["settle", "k", null, "alpha", "actor-1", -1],
      ["move", "k", null, "alpha", "actor-1", 0],
    ];
    for (const row of invalidRows)
      expect(() => insert.run(...row)).toThrow("CHECK constraint failed");
  });
  it("matches the specified schema and refuses updates and deletes on populated tables", () => {
    const s = setup();
    s.reserve(20);
    s.actual(12);
    s.ledger.settle({ actor: "actor-1" });
    const expected = new DatabaseSync(":memory:");
    cleanup.push(() => expected.close());
    expected.exec(
      readFileSync(
        new URL("../../../../docs/specifications/portfolio-ledger-tables.sql", import.meta.url),
        "utf8",
      ),
    );
    const schema =
      "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY name";
    expect(s.database.prepare(schema).all()).toEqual(expected.prepare(schema).all());
    for (const table of [
      "ledger_entries",
      "ledger_operations",
      "ledger_windows",
      "ledger_settlements",
    ]) {
      const before = s.database.prepare(`SELECT * FROM ${table}`).all();
      expect(before.length).toBeGreaterThan(0);
      for (const operation of [
        `DELETE FROM ${table}`,
        `UPDATE ${table} SET ${table === "ledger_settlements" ? "actor = actor" : table === "ledger_windows" ? "account = account" : table === "ledger_operations" ? "key = key" : "amount = amount"}`,
      ])
        expect(() => s.database.exec(operation)).toThrow("append-only");
      expect(s.database.prepare(`SELECT * FROM ${table}`).all()).toEqual(before);
    }
  });
});

describe("portfolio and operation boundaries", () => {
  it("rejects duplicate item ids without allocation rows", () => {
    errorCode(
      () =>
        parseLedgerPortfolio({
          items: [
            { id: "alpha", parent: null },
            { id: "alpha", parent: null },
          ],
          allocations: [],
        }),
      "invalid-portfolio",
    );
  });

  it.each([
    null,
    { items: null, allocations: [] },
    { items: [], allocations: null },
    { items: [null], allocations: [] },
    { items: [{ id: "alpha", parent: null }], allocations: [null] },
    { items: [{ id: "alpha", parent: null, archived: "yes" }], allocations: [] },
  ])("rejects malformed runtime shape %#", (input) => {
    errorCode(
      () => parseLedgerPortfolio(input as unknown as LedgerPortfolioInput),
      "invalid-portfolio",
    );
  });
  it.each([NaN, Infinity, 0.00000000001])("rejects an invalid percentage %s", (guarantee) => {
    const input = split();
    input.allocations[0]!.guarantee = guarantee;
    errorCode(() => parseLedgerPortfolio(input), "invalid-portfolio");
  });
  it.each([0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid weight %s",
    (weight) => {
      const input = split();
      input.allocations[0]!.weight = weight;
      errorCode(() => parseLedgerPortfolio(input), "invalid-portfolio");
    },
  );
  it("rejects empty portfolio account and operation waiting fields", () => {
    const input = split();
    input.allocations[0]!.account = "";
    errorCode(() => parseLedgerPortfolio(input), "invalid-portfolio");
    const s = setup();
    errorCode(
      () =>
        s.ledger.balance({ item: "alpha", account: "acct", waiting: null as unknown as string[] }),
      "invalid-input",
    );
    errorCode(
      () => s.ledger.balance({ item: "alpha", account: "acct", waiting: [""] }),
      "invalid-input",
    );
    errorCode(() => s.actual(-1), "invalid-input");
    errorCode(() => s.actual(1, "alpha", "actor-1", 0.5), "invalid-input");
  });

  it("reports guarantee overflow at top level and under a named parent", () => {
    expect(() => parseLedgerPortfolio(split(70, 40))).toThrow("110%");
    try {
      parseLedgerPortfolio(split(70, 40));
    } catch (error) {
      expect(error).toMatchObject({
        code: "guarantee-limit",
        details: { parent: null, sum: 110, account: "acct" },
      });
    }
    const input = split(60, 50);
    input.items.unshift({ id: "gamma", parent: null });
    input.items[1]!.parent = "gamma";
    input.items[2]!.parent = "gamma";
    expect(() => parseLedgerPortfolio(input)).toThrow('"gamma"');
    expect(() =>
      parseLedgerPortfolio({
        items: ["alpha", "beta", "gamma"].map((id) => ({ id, parent: null })),
        allocations: ["alpha", "beta", "gamma"].map((item) => ({
          item,
          account: "acct",
          guarantee: 33.33,
        })),
      }),
    ).not.toThrow();
  });
  it.each([
    (p: LedgerPortfolioInput) => {
      p.items[0]!.id = "";
    },
    (p: LedgerPortfolioInput) => {
      p.items[1]!.id = "alpha";
    },
    (p: LedgerPortfolioInput) => {
      p.items[0]!.parent = "missing";
    },
    (p: LedgerPortfolioInput) => {
      p.items[0]!.parent = "beta";
      p.items[1]!.parent = "alpha";
    },
    (p: LedgerPortfolioInput) => {
      p.allocations.push({ ...p.allocations[0]! });
    },
    (p: LedgerPortfolioInput) => {
      p.allocations[0]!.item = "missing";
    },
    (p: LedgerPortfolioInput) => {
      p.items[0]!.archived = true;
    },
    (p: LedgerPortfolioInput) => {
      p.items[0]!.archived = true;
      p.allocations.shift();
      p.items[1]!.parent = "alpha";
    },
    (p: LedgerPortfolioInput) => {
      p.allocations[0]!.guarantee = 100.01;
    },
    (p: LedgerPortfolioInput) => {
      p.allocations[0]!.guarantee = -1;
    },
    (p: LedgerPortfolioInput) => {
      p.allocations[0]!.guarantee = 0.001;
    },
    (p: LedgerPortfolioInput) => {
      p.allocations[0]!.ceiling = 49;
    },
    (p: LedgerPortfolioInput) => {
      p.allocations[0]!.weight = 0;
    },
    (p: LedgerPortfolioInput) => {
      p.allocations[0]!.pacing = { burst: 100.01 };
    },
  ])("rejects malformed portfolio %#", (change) => {
    const input = split();
    change(input);
    errorCode(() => parseLedgerPortfolio(input), "invalid-portfolio");
  });
  it("floors large integer allocations exactly and isolates accounts", () => {
    const s = setup(split(33.33, 33.33), false);
    s.credit("large", "w1", 0, Number.MAX_SAFE_INTEGER);
    expect(s.balance().allocation).toBe(Number((BigInt(Number.MAX_SAFE_INTEGER) * 3333n) / 10000n));
    expect(s.ledger.balance({ item: "alpha", account: "other", waiting: [] }).window).toBeNull();
  });
  it("validates requests before writing", () => {
    const s = setup();
    const before = s.database.prepare("SELECT count(*) AS n FROM ledger_operations").get();
    for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity])
      errorCode(() => s.reserve(amount), "invalid-input");
    errorCode(() => s.reserve(1, "missing"), "invalid-input");
    errorCode(() => s.move("actor-1", "bad", "alpha", "alpha"), "invalid-input");
    errorCode(
      () => s.ledger.balance({ item: "missing", account: "acct", waiting: [] }),
      "invalid-input",
    );
    errorCode(() => s.reserve(1, "alpha", ""), "invalid-input");
    errorCode(() => s.credit("", "w1"), "invalid-input");
    errorCode(
      () =>
        s.ledger.credit({
          key: "bad",
          account: "acct",
          window: "bad",
          opensAt: 5,
          closesAt: 5,
          amount: 1,
        }),
      "invalid-input",
    );
    expect(s.database.prepare("SELECT count(*) AS n FROM ledger_operations").get()).toEqual(before);
  });
});
