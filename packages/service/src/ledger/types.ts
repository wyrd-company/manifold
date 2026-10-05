// ---
// relationships:
//   implements: portfolio-ledger
// ---
export type LedgerSqlValue = null | number | bigint | string | Uint8Array;
export interface LedgerStatement {
  run(...params: LedgerSqlValue[]): unknown;
  get(...params: LedgerSqlValue[]): unknown;
  all(...params: LedgerSqlValue[]): unknown[];
}
export interface LedgerDatabase {
  prepare(sql: string): LedgerStatement;
}
export interface LedgerConnection {
  readonly database: LedgerDatabase;
  transaction<T>(work: () => T): T;
}
export type { LedgerPortfolioInput, LedgerErrorCode } from "@wyrd-company/manifold-shared";
export { LedgerError } from "@wyrd-company/manifold-shared";
export type LedgerWriteResult = { replayed: boolean };
export type LedgerMoveResult =
  | { moved: true; amount: number; replayed: boolean }
  | { moved: false; amount: number; reservable: number };
export type LedgerSettleResult = { retired: { item: string; account: string; amount: number }[] };
export type LedgerBalance = {
  window: string | null;
  allocation: number;
  actual: number;
  outstanding: number;
  available: number;
  reservable: number;
};
export type LedgerActorUsage = {
  settled: boolean;
  accounts: {
    account: string;
    estimate: number;
    actual: number;
    variance: number;
    outstanding: number;
  }[];
};
export type LedgerWindow = { window: string; opensAt: number; closesAt: number; capacity: number };
export type LedgerWindows = { current: LedgerWindow | null; next: LedgerWindow | null };
export interface Ledger {
  windowAt(query: { account: string; at: number }): LedgerWindows;
  setPortfolio(portfolio: import("./portfolio.js").LedgerPortfolio): void;
  credit(request: {
    key: string;
    account: string;
    window: string;
    opensAt: number;
    closesAt: number;
    amount: number;
  }): LedgerWriteResult;
  reserve(request: {
    key: string;
    actor: string;
    item: string;
    account: string;
    amount: number;
  }): LedgerWriteResult;
  postActual(request: {
    key: string;
    actor: string;
    item: string;
    account: string;
    amount: number;
    usedAt: number;
  }): LedgerWriteResult;
  move(request: {
    key: string;
    actor: string;
    account: string;
    from: string;
    to: string;
    waiting: readonly string[];
  }): LedgerMoveResult;
  settle(request: { actor: string }): LedgerSettleResult;
  balance(query: { item: string; account: string; waiting: readonly string[] }): LedgerBalance;
  actorUsage(actor: string): LedgerActorUsage;
}
