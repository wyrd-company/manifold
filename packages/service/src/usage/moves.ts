// ---
// relationships:
//   implements: [usage-intake, usage-api]
// ---
import { isUnownedActor } from "@wyrd-company/manifold-shared/usage-api";
import type { UsageMoveRequest, UsageMoveResponse } from "@wyrd-company/manifold-shared/usage-api";
import { LedgerError } from "../ledger/index.ts";
import type { UsageOptions } from "./types.ts";
export class UsageMoveError extends Error {
  readonly code: "unknown-actor" | "invalid-target";
  constructor(code: "unknown-actor" | "invalid-target", message: string) {
    super(message);
    this.code = code;
  }
}
export function visitAt(options: UsageOptions, actor: string, usedAt: number): number | null {
  const row = options.connection.database
    .prepare(
      "SELECT visit FROM usage_visits WHERE actor_id=? ORDER BY (entered_at<=?) DESC, CASE WHEN entered_at<=? THEN entered_at END DESC,CASE WHEN entered_at<=? THEN visit END DESC,entered_at ASC,visit ASC LIMIT 1",
    )
    .get(actor, usedAt, usedAt, usedAt) as { visit: number } | undefined;
  return row?.visit ?? null;
}
export function moveUsage(
  options: UsageOptions,
  now: () => number,
  request: UsageMoveRequest,
): UsageMoveResponse {
  const result = options.connection.transaction(() => {
    const db = options.connection.database;
    const { from, to } = request;
    let target: { actor: string; item: string };
    if ("item" in to) target = { actor: from, item: to.item };
    else {
      const actor = isUnownedActor(to.actor)
        ? undefined
        : (db.prepare("SELECT item FROM usage_actors WHERE actor_id=?").get(to.actor) as
            | { item: string | null }
            | undefined);
      if (!actor)
        throw new UsageMoveError(
          "unknown-actor",
          "This task has not started, so its usage cannot be counted yet.",
        );
      target = { actor: to.actor, item: actor.item ?? "other" };
    }
    const items = new Map(
      options.portfolio.current().declaration.items.map((item) => [item.id, item]),
    );
    let item = items.get(target.item);
    if (!item)
      throw new UsageMoveError("invalid-target", "Choose a portfolio item that is not archived.");
    while (item) {
      if (item.archived)
        throw new UsageMoveError("invalid-target", "Choose a portfolio item that is not archived.");
      item = item.parent === null ? undefined : items.get(item.parent);
    }
    const postings = db
      .prepare(
        "SELECT seq,held_actor,held_item,account,amount,used_at,moves FROM usage_attributed_postings WHERE status='posted' AND attributed_actor=? ORDER BY seq",
      )
      .all(from) as {
      seq: number;
      held_actor: string;
      held_item: string;
      account: string;
      amount: number;
      used_at: number;
      moves: number;
    }[];
    const accounts = new Map<string, number>();
    let moved = 0;
    for (const posting of postings) {
      if (posting.held_actor === target.actor && posting.held_item === target.item) continue;
      const key = posting.amount > 0 ? `usage-move:${posting.seq}:${posting.moves + 1}` : null;
      if (key) {
        try {
          options.ledger.reattribute({
            key,
            account: posting.account,
            amount: posting.amount,
            usedAt: posting.used_at,
            from: { actor: posting.held_actor, item: posting.held_item },
            to: target,
          });
        } catch (error) {
          if (error instanceof LedgerError && error.code === "invalid-input")
            throw new UsageMoveError("invalid-target", error.message);
          throw error;
        }
      }
      db.prepare(
        "INSERT INTO usage_reattributions (posting,cause,actor,item,visit,ledger_key,recorded_at) VALUES (?,'move',?,?,?,?,?)",
      ).run(
        posting.seq,
        target.actor,
        target.item,
        "actor" in to ? visitAt(options, target.actor, posting.used_at) : null,
        key,
        now(),
      );
      moved++;
      accounts.set(posting.account, (accounts.get(posting.account) ?? 0) + posting.amount);
    }
    return {
      status: "moved" as const,
      from,
      to: target,
      moved,
      accounts: [...accounts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([account, amount]) => ({ account, amount })),
    };
  });
  if (result.moved) options.inputChanged?.();
  return result;
}
