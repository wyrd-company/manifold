// ---
// relationships:
//   implements: portfolio
// ---
import type { UsageAccount } from "@wyrd-company/manifold-shared";
import type { Ledger, LedgerConnection } from "../ledger/index.ts";
export type CapacityAccount = Pick<UsageAccount, "kind" | "capacity" | "archived">;
export type CapacityCredit = {
  account: string;
  window: string;
  opensAt: number;
  closesAt: number;
  amount: number;
};
export type CapacityEnsureResult =
  | { status: "covered"; window: string }
  | { status: "credited"; credit: CapacityCredit; replayed: boolean }
  | { status: "undeclared" }
  | { status: "out-of-range" };
export interface Capacity {
  readonly ledger: Ledger;
  ensure(request: { account: string; at: number }): CapacityEnsureResult;
  close(): void;
}
export type CapacityOptions = {
  connection: LedgerConnection;
  ledger: Ledger;
  accounts(): Readonly<Record<string, CapacityAccount>>;
  now?: () => number;
  credited(credit: CapacityCredit): void;
  followUp(): void;
};
