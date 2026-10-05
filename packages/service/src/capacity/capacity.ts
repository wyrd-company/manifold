// ---
// relationships:
//   implements: portfolio
// ---
import { LedgerError } from "../ledger/index.ts";
import { capacityWindow, capacityTimeSupported } from "./windows.ts";
import type { Capacity, CapacityEnsureResult, CapacityOptions } from "./types.ts";
export function openCapacity(options: CapacityOptions): Capacity {
  const { connection, ledger } = options;
  const now = options.now ?? Date.now;
  const pending = new Map<string, { account: string; at: number }>();
  let scheduled: NodeJS.Immediate | undefined;
  let dirty = false;
  let closed = false;
  function schedule() {
    if (closed || scheduled) return;
    scheduled = setImmediate(() => {
      scheduled = undefined;
      const requests = [...pending.values()];
      pending.clear();
      for (const request of requests) ensure(request);
      if (dirty) {
        dirty = false;
        options.followUp();
      }
    });
  }
  function ensure(request: { account: string; at: number }): CapacityEnsureResult {
    const result = connection.transaction((): CapacityEnsureResult => {
      const account = options.accounts()[request.account];
      if (!account) return { status: "undeclared" };
      if (!capacityTimeSupported(request.at)) return { status: "out-of-range" };
      const neighbours = ledger.windowAt(request);
      if (neighbours.current && neighbours.current.closesAt > request.at)
        return { status: "covered", window: neighbours.current.window };
      const window = capacityWindow(account.capacity, request.at, neighbours);
      const credit = { account: request.account, ...window };
      const { replayed } = ledger.credit({
        ...credit,
        key: `capacity:${request.account}:${window.window}`,
      });
      return { status: "credited", credit, replayed };
    });
    if (result.status === "credited" && !result.replayed) {
      dirty = true;
      schedule();
      options.credited(result.credit);
    }
    return result;
  }
  return {
    ensure,
    ledger: {
      ...ledger,
      reserve: (request) =>
        connection.transaction(() => {
          ensure({ account: request.account, at: now() });
          return ledger.reserve(request);
        }),
      balance: (request) =>
        connection.transaction(() => {
          ensure({ account: request.account, at: now() });
          return ledger.balance(request);
        }),
      postActual: (request) =>
        connection.transaction(() => {
          const { current } = ledger.windowAt({ account: request.account, at: request.usedAt });
          if (current && current.closesAt > request.usedAt) return ledger.postActual(request);
          pending.set(JSON.stringify([request.account, request.usedAt]), {
            account: request.account,
            at: request.usedAt,
          });
          schedule();
          throw new LedgerError(
            "no-window",
            `No window for account "${request.account}" at ${request.usedAt}.`,
            { account: request.account, at: request.usedAt },
          );
        }),
    },
    close() {
      closed = true;
      if (scheduled) clearImmediate(scheduled);
      scheduled = undefined;
      pending.clear();
      dirty = false;
    },
  };
}
