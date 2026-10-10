// ---
// relationships:
//   implements: [usage-intake, usage-api]
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
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
  return options.visits.visitAt(actor, usedAt) ?? null;
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
        : (readUsageActors(
            db
              .prepare("SELECT CAST(item AS BLOB) AS item FROM usage_actors WHERE actor_id=?")
              .get(to.actor),
          ) as { item: string | null } | undefined);
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
        "SELECT seq, CAST(held_actor AS BLOB) AS held_actor, CAST(held_item AS BLOB) AS held_item, CAST(account AS BLOB) AS account, amount, used_at, moves FROM usage_attributed_postings WHERE (status='posted' OR reason='unmetered') AND attributed_actor=? ORDER BY seq",
      )
      .all(from)
      .map(readUsageAttributedPostings) as {
      seq: number;
      held_actor: string;
      held_item: string;
      account: string | null;
      amount: number | null;
      used_at: number;
      moves: number;
    }[];
    const accounts = new Map<string, number>();
    let moved = 0;
    for (const posting of postings) {
      if (posting.held_actor === target.actor && posting.held_item === target.item) continue;
      const key =
        posting.amount !== null && posting.amount > 0
          ? `usage-move:${posting.seq}:${posting.moves + 1}`
          : null;
      if (key) {
        try {
          options.ledger.reattribute({
            key,
            account: posting.account!,
            amount: posting.amount!,
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
      if (posting.account !== null)
        accounts.set(posting.account, (accounts.get(posting.account) ?? 0) + (posting.amount ?? 0));
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

function readUsageActors<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, item: values["item"] === null ? null : storedText(values["item"]!) } as T;
}
function readUsageAttributedPostings<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    held_actor: storedText(values["held_actor"]!),
    held_item: storedText(values["held_item"]!),
    account: values["account"] === null ? null : storedText(values["account"]!),
  } as T;
}
