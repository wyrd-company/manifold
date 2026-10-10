// ---
// relationships:
//   implements: gate-runtime
// ---
import { parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import { LedgerError } from "../ledger/index.ts";
import type { Store, PersistedSnapshot } from "../store/index.ts";
import type { GateVersion, GatesOptions, GateInput } from "./types.ts";
import type { GateTables } from "./tables.ts";
import { record, statePaths } from "./declaration.ts";
import { canonicalJson, compareText } from "./values.ts";
export function itemOf(snapshot: PersistedSnapshot | undefined): string {
  const item = record(record(snapshot?.["context"])["manifold"])["portfolioItem"];
  return typeof item === "string" ? item : "other";
}
export function population(store: Store, gate: string) {
  const split = gate.lastIndexOf("#"),
    path = gate.slice(0, split),
    statePath = gate.slice(split + 1);
  return store
    .findActorsInState({ statePath })
    .filter(
      (s) => s.snapshot.status === "active" && parseBlueprintVersionKey(s.machine)?.path === path,
    );
}
export function gateInput(
  options: GatesOptions,
  tables: GateTables,
  views: ReadonlyMap<string, GateVersion>,
  gate: string,
  time: number,
  critical: (id: string | undefined) => number,
): GateInput {
  const statePath = gate.slice(gate.lastIndexOf("#") + 1),
    holders = tables.holders(gate),
    held = new Set(holders.map((t) => t.actor_id));
  const members = population(options.store, gate)
    .filter((s) => !held.has(s.actorId) && options.store.pendingInbox(s.actorId).length === 0)
    .flatMap((s) => {
      const entry = tables.entry(gate, s.actorId),
        view = views.get(s.machine),
        declaration = view?.declarations.find((d) => d.statePath === statePath);
      if (!entry || tables.granted(entry.entry_id) || !declaration) return [];
      const context = record(s.snapshot["context"]),
        issue = record(context["manifold"])["issue"];
      return [
        {
          id: s.actorId,
          fields: record(context["fields"]),
          age: Math.max(0, Math.floor(time - entry.entered_at)),
          dependencies:
            declaration.dependencies &&
            statePaths(s.snapshot).includes(`${declaration.dependencies}.blocked`)
              ? ("blocked" as const)
              : ("clear" as const),
          criticalPath: critical(typeof issue === "string" ? issue : undefined),
          item: itemOf(s.snapshot),
        },
      ];
    });
  const holderInput = holders.map((t) => ({
    id: t.actor_id,
    item: itemOf(options.store.loadSnapshot(t.actor_id)?.snapshot),
  }));
  const waiting = [...new Set(members.map((m) => m.item))].sort(compareText),
    items = [...new Set([...waiting, ...holderInput.map((h) => h.item)])].sort(compareText);
  const portfolio = options.portfolio.current().declaration.ledger,
    known = new Set(portfolio.items.map((i) => i.id)),
    accounts = [...new Set(portfolio.allocations.map((a) => a.account))].sort(compareText);
  const balances: Record<string, Record<string, number>> = {};
  for (const item of items)
    if (known.has(item)) {
      const amounts: Record<string, number> = {};
      for (const account of accounts) {
        try {
          amounts[account] = options.portfolio.ledger.balance({
            item,
            account,
            waiting,
          }).reservable;
        } catch (error) {
          if (!(error instanceof LedgerError)) throw error;
        }
      }
      balances[item] = amounts;
    }
  return JSON.parse(
    canonicalJson({ population: members, holders: holderInput, balances }),
  ) as GateInput;
}
