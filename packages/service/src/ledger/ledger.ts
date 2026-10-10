// ---
// relationships:
//   implements: portfolio-ledger
//   references: portfolio-ledger-tables
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import { LedgerError } from "./types.js";
import type { Ledger, LedgerConnection, LedgerWriteResult } from "./types.js";
import { portfolioData } from "./portfolio.js";
import type { LedgerPortfolio } from "./portfolio.js";
import { foldHolds, itemTotals } from "./balance.js";
import type { Entry } from "./balance.js";
import { sharingRule } from "./sharing-rule.js";
type Window = { window_key: string; opens_at: number; closes_at: number };
type Operation = { kind: string; request: string };
function invalid(field: string, value: unknown): never {
  throw new LedgerError("invalid-input", `Invalid ${field}: ${String(value)}.`, { [field]: value });
}
function text(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) invalid(field, value);
}
function integer(value: unknown, field: string, minimum?: number): asserts value is number {
  if (!Number.isSafeInteger(value) || (minimum !== undefined && (value as number) < minimum))
    invalid(field, value);
}
function waitingItems(value: readonly string[]) {
  if (!Array.isArray(value)) invalid("waiting", value);
  for (const item of value) text(item, "waiting item");
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function createLedger(options: {
  connection: LedgerConnection;
  portfolio: LedgerPortfolio;
  now?: () => number;
}): Ledger {
  const { connection } = options;
  const { database } = connection;
  let portfolio = options.portfolio;
  const now = options.now ?? Date.now;
  const entryInsert = database.prepare(
    "INSERT INTO ledger_entries (kind, operation, account, window_key, item, actor, amount, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const operationInsert = database.prepare(
    "INSERT INTO ledger_operations (key, kind, request, at) VALUES (?, ?, ?, ?)",
  );
  const operationGet = database.prepare(
    "SELECT kind, request FROM ledger_operations WHERE key = ?",
  );
  const settlementGet = database.prepare(
    "SELECT CAST(actor AS BLOB) AS actor FROM ledger_settlements WHERE actor = ?",
  );
  const windowAt = database.prepare(
    "SELECT CAST(window_key AS BLOB) AS window_key, opens_at, closes_at FROM ledger_windows WHERE account = ? AND opens_at <= ? ORDER BY opens_at DESC LIMIT 1",
  );
  const windowByKey = database.prepare(
    "SELECT CAST(window_key AS BLOB) AS window_key, opens_at, closes_at FROM ledger_windows WHERE account = ? AND window_key = ?",
  );
  const windowByOpening = database.prepare(
    "SELECT CAST(window_key AS BLOB) AS window_key FROM ledger_windows WHERE account = ? AND opens_at = ?",
  );
  const windowInsert = database.prepare(
    "INSERT INTO ledger_windows (account, window_key, opens_at, closes_at) VALUES (?, ?, ?, ?)",
  );
  const settlementInsert = database.prepare(
    "INSERT OR IGNORE INTO ledger_settlements (actor, at) VALUES (?, ?)",
  );
  const entryColumns =
    "kind, CAST(account AS BLOB) AS account, CAST(window_key AS BLOB) AS window_key, CAST(item AS BLOB) AS item, CAST(actor AS BLOB) AS actor, CAST(amount AS TEXT) AS amount";
  const accountEntries = database.prepare(
    `SELECT ${entryColumns} FROM ledger_entries WHERE account = ? ORDER BY seq`,
  );
  const actorEntries = database.prepare(
    `SELECT ${entryColumns} FROM ledger_entries WHERE actor = ? ORDER BY seq`,
  );
  const moveAmount = database.prepare(
    "SELECT CAST(amount AS TEXT) AS amount FROM ledger_entries WHERE operation = ? AND kind = 'move' AND amount > 0",
  );
  function load(rows: unknown[]): Entry[] {
    return (
      (rows as Record<string, SQLOutputValue>[]).map(readLedgerEntry) as unknown as (Omit<
        Entry,
        "amount"
      > & { amount: string })[]
    ).map((row) => ({
      ...row,
      amount: BigInt(row.amount),
    }));
  }
  function window(account: string, at: number): Window | null {
    return (readLedgerWindows(windowAt.get(account, at)) as Window | undefined) ?? null;
  }
  function requireWindow(account: string, at: number): Window {
    const current = window(account, at);
    if (!current)
      throw new LedgerError("no-window", `No window for account "${account}" at ${at}.`, {
        account,
        at,
      });
    return current;
  }
  function knownItem(item: string, live = false) {
    const node = portfolioData(portfolio).items.get(item);
    if (!node || (live && node.archived)) invalid("item", item);
  }
  function append(
    kind: Entry["kind"],
    key: string | null,
    account: string,
    windowKey: string | null,
    item: string | null,
    actor: string | null,
    amount: bigint | number,
    at: number,
  ) {
    entryInsert.run(kind, key, account, windowKey, item, actor, amount, at);
  }
  function replay(key: string, kind: string, request: string) {
    const prior = operationGet.get(key) as Operation | undefined;
    if (!prior) return false;
    if (prior.kind !== kind || prior.request !== request)
      throw new LedgerError(
        "idempotency-conflict",
        `Idempotency key "${key}" has a different request.`,
        { key, kind },
      );
    return true;
  }
  function write(
    key: string,
    kind: string,
    request: unknown,
    work: (at: number) => void,
  ): LedgerWriteResult {
    const serialized = canonical(request);
    return connection.transaction(() => {
      if (replay(key, kind, serialized)) return { replayed: true };
      const at = now();
      operationInsert.run(key, kind, serialized, at);
      work(at);
      return { replayed: false };
    });
  }
  function readBalance(
    item: string,
    account: string,
    waiting: readonly string[],
    at: number,
    remove?: { actor: string; item: string; amount: bigint },
  ) {
    const current = window(account, at);
    if (!current)
      return {
        window: null,
        allocation: 0n,
        actual: 0n,
        outstanding: 0n,
        available: 0n,
        reservable: 0n,
      };
    const entries = load(accountEntries.all(account));
    let capacity = 0n;
    const actuals = new Map<string, bigint>();
    for (const entry of entries) {
      if (entry.window_key !== current.window_key) continue;
      if (entry.kind === "credit") capacity += BigInt(entry.amount);
      if (entry.kind === "actual" || entry.kind === "reattribute")
        actuals.set(entry.item!, (actuals.get(entry.item!) ?? 0n) + BigInt(entry.amount));
    }
    const outstanding = new Map<string, bigint>();
    for (const hold of foldHolds(entries)) {
      const amount =
        hold.outstanding -
        (remove?.actor === hold.actor && remove.item === hold.item ? remove.amount : 0n);
      outstanding.set(hold.item, (outstanding.get(hold.item) ?? 0n) + amount);
    }
    const actualTotals = itemTotals(portfolio, actuals);
    const holdTotals = itemTotals(portfolio, outstanding);
    const usage = new Map(actualTotals.totals);
    for (const [id, amount] of holdTotals.totals) usage.set(id, (usage.get(id) ?? 0n) + amount);
    const share = sharingRule({
      portfolio,
      account,
      item,
      capacity,
      opensAt: current.opens_at,
      closesAt: current.closes_at,
      now: at,
      usage,
      unknown: actualTotals.unknown + holdTotals.unknown,
      total: actualTotals.total + holdTotals.total,
      waiting,
    });
    const actual = actualTotals.totals.get(item) ?? 0n;
    const held = holdTotals.totals.get(item) ?? 0n;
    return {
      window: current.window_key,
      allocation: share.allocation,
      actual,
      outstanding: held,
      available: share.allocation - actual - held,
      reservable: share.reservable,
    };
  }
  const nextWindow = database.prepare(
    "SELECT CAST(window_key AS BLOB) AS window_key, opens_at, closes_at FROM ledger_windows WHERE account = ? AND opens_at > ? ORDER BY opens_at LIMIT 1",
  );
  const windowCapacity = database.prepare(
    "SELECT CAST(COALESCE(SUM(amount), 0) AS TEXT) AS capacity FROM ledger_entries WHERE account = ? AND window_key = ? AND kind = 'credit'",
  );
  function describeWindow(account: string, row: Window | undefined | null) {
    if (!row) return null;
    const amount = windowCapacity.get(account, row.window_key) as { capacity: string };
    return {
      window: row.window_key,
      opensAt: row.opens_at,
      closesAt: row.closes_at,
      capacity: Number(amount.capacity),
    };
  }
  return {
    totals({ account }) {
      text(account, "account");
      const current = window(account, now());
      const entries = load(accountEntries.all(account));
      const lifetime = new Map<string, bigint>();
      let used = 0n;
      for (const entry of entries) {
        if (entry.kind !== "actual" && entry.kind !== "reattribute") continue;
        lifetime.set(entry.item!, (lifetime.get(entry.item!) ?? 0n) + BigInt(entry.amount));
        if (current && entry.window_key === current.window_key) used += BigInt(entry.amount);
      }
      for (const hold of foldHolds(entries)) used += hold.outstanding;
      return {
        window: describeWindow(account, current),
        used: Number(used),
        items: [...lifetime]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([item, amount]) => ({ item, lifetime: Number(amount) })),
      };
    },
    windowAt({ account, at }) {
      text(account, "account");
      integer(at, "at");
      return {
        current: describeWindow(account, window(account, at)),
        next: describeWindow(
          account,
          readLedgerWindows(nextWindow.get(account, at)) as Window | undefined,
        ),
      };
    },
    setPortfolio(value) {
      portfolio = value;
    },
    credit(request) {
      const { key, account, window: windowKey, amount, opensAt, closesAt } = request;
      text(key, "key");
      text(account, "account");
      text(windowKey, "window");
      integer(amount, "amount", 1);
      integer(opensAt, "opensAt");
      integer(closesAt, "closesAt");
      if (closesAt <= opensAt) invalid("closesAt", closesAt);
      return write(key, "credit", request, (at) => {
        const prior = readLedgerWindows(windowByKey.get(account, windowKey)) as Window | undefined;
        if (
          prior
            ? prior.opens_at !== opensAt || prior.closes_at !== closesAt
            : readLedgerWindows(windowByOpening.get(account, opensAt))
        )
          throw new LedgerError(
            "window-conflict",
            `Conflicting window "${windowKey}" for account "${account}" at ${opensAt}.`,
            { account, window: windowKey, opensAt, closesAt },
          );
        if (!prior) windowInsert.run(account, windowKey, opensAt, closesAt);
        append("credit", key, account, windowKey, null, null, amount, at);
      });
    },
    reserve(request) {
      const { key, actor, item, account, amount } = request;
      text(key, "key");
      text(actor, "actor");
      text(item, "item");
      text(account, "account");
      integer(amount, "amount", 1);
      return write(key, "reserve", request, (at) => {
        knownItem(item, true);
        if (readLedgerSettlements(settlementGet.get(actor)))
          throw new LedgerError("actor-settled", `Actor "${actor}" is settled.`, { actor });
        requireWindow(account, at);
        append("reserve", key, account, null, item, actor, amount, at);
      });
    },
    postActual(request) {
      const { key, actor, item, account, amount, usedAt } = request;
      text(key, "key");
      text(actor, "actor");
      text(item, "item");
      text(account, "account");
      integer(amount, "amount", 0);
      integer(usedAt, "usedAt");
      return write(key, "actual", request, (at) => {
        const current = requireWindow(account, usedAt);
        append("actual", key, account, current.window_key, item, actor, amount, at);
      });
    },
    reattribute(request) {
      const { key, account, amount, usedAt, from, to } = request;
      text(key, "key");
      text(account, "account");
      integer(amount, "amount", 1);
      integer(usedAt, "usedAt");
      text(from.actor, "from.actor");
      text(from.item, "from.item");
      text(to.actor, "to.actor");
      text(to.item, "to.item");
      return write(key, "reattribute", request, (at) => {
        knownItem(to.item, true);
        if (from.actor === to.actor && from.item === to.item) invalid("to", to);
        const current = requireWindow(account, usedAt);
        append("reattribute", key, account, current.window_key, from.item, from.actor, -amount, at);
        append("reattribute", key, account, current.window_key, to.item, to.actor, amount, at);
      });
    },
    move(request) {
      const { key, actor, account, from, to, waiting } = request;
      text(key, "key");
      text(actor, "actor");
      text(account, "account");
      text(from, "from");
      text(to, "to");
      waitingItems(waiting);
      const serialized = canonical({ ...request, waiting: [...waiting].sort() });
      return connection.transaction(() => {
        if (replay(key, "move", serialized)) {
          const row = moveAmount.get(key) as { amount: string } | undefined;
          return { moved: true, amount: Number(row?.amount ?? 0), replayed: true };
        }
        if (from === to) invalid("to", to);
        knownItem(to, true);
        const entries = load(actorEntries.all(actor));
        const amount =
          foldHolds(entries).find((hold) => hold.account === account && hold.item === from)
            ?.outstanding ?? 0n;
        const at = now();
        if (amount > 0n) {
          const reservable = readBalance(to, account, waiting, at, {
            actor,
            item: from,
            amount,
          }).reservable;
          if (reservable < amount)
            return { moved: false, amount: Number(amount), reservable: Number(reservable) };
          append("move", key, account, null, from, actor, -amount, at);
          append("move", key, account, null, to, actor, amount, at);
        }
        operationInsert.run(key, "move", serialized, at);
        return { moved: true, amount: Number(amount), replayed: false };
      });
    },
    settle({ actor }) {
      text(actor, "actor");
      return connection.transaction(() => {
        const at = now();
        settlementInsert.run(actor, at);
        const retired: { item: string; account: string; amount: number }[] = [];
        for (const hold of foldHolds(load(actorEntries.all(actor)))) {
          if (hold.net <= 0n) continue;
          append("settle", null, hold.account, null, hold.item, actor, -hold.net, at);
          retired.push({ item: hold.item, account: hold.account, amount: Number(hold.net) });
        }
        return { retired };
      });
    },
    balance({ item, account, waiting }) {
      text(item, "item");
      text(account, "account");
      waitingItems(waiting);
      knownItem(item);
      const result = readBalance(item, account, waiting, now());
      return {
        window: result.window,
        allocation: Number(result.allocation),
        actual: Number(result.actual),
        outstanding: Number(result.outstanding),
        available: Number(result.available),
        reservable: Number(result.reservable),
      };
    },
    actorUsage(actor) {
      text(actor, "actor");
      const entries = load(actorEntries.all(actor));
      const accounts = new Map<string, { estimate: bigint; actual: bigint; outstanding: bigint }>();
      for (const entry of entries) {
        const row = accounts.get(entry.account) ?? { estimate: 0n, actual: 0n, outstanding: 0n };
        if (entry.kind === "reserve") row.estimate += BigInt(entry.amount);
        if (entry.kind === "actual" || entry.kind === "reattribute")
          row.actual += BigInt(entry.amount);
        accounts.set(entry.account, row);
      }
      for (const hold of foldHolds(entries))
        accounts.get(hold.account)!.outstanding += hold.outstanding;
      return {
        settled: Boolean(readLedgerSettlements(settlementGet.get(actor))),
        accounts: [...accounts].map(([account, row]) => ({
          account,
          estimate: Number(row.estimate),
          actual: Number(row.actual),
          variance: Number(row.actual - row.estimate),
          outstanding: Number(row.outstanding),
        })),
      };
    },
  };
}

function readLedgerSettlements<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, actor: storedText(values["actor"]!) } as T;
}
function readLedgerWindows<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, window_key: storedText(values["window_key"]!) } as T;
}

function readLedgerEntry(row: Record<string, SQLOutputValue>): Record<string, SQLOutputValue> {
  return {
    ...row,
    account: storedText(row["account"]!),
    window_key: row["window_key"] === null ? null : storedText(row["window_key"]!),
    item: row["item"] === null ? null : storedText(row["item"]!),
    actor: row["actor"] === null ? null : storedText(row["actor"]!),
  };
}
