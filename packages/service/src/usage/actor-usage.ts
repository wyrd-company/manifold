// ---
// relationships:
//   implements: usage-intake
// ---
import type { LedgerActorUsage } from "../ledger/index.ts";
import type { UsageOptions } from "./types.ts";

export function actorUsage(options: UsageOptions, actor: string): LedgerActorUsage {
  const usage = options.ledger.actorUsage(actor);
  const rows = options.connection.database
    .prepare(`
    SELECT p.account, sum(CASE WHEN l.actor=? THEN p.amount ELSE 0 END) - sum(CASE WHEN p.actor=? THEN p.amount ELSE 0 END) AS delta
    FROM usage_late_attributions l JOIN usage_postings p USING(seq)
    WHERE p.status='posted' AND (l.actor=? OR p.actor=?) GROUP BY p.account ORDER BY p.account
  `)
    .all(actor, actor, actor, actor) as { account: string; delta: number }[];
  const accounts = new Map(usage.accounts.map((row) => [row.account, row]));
  for (const { account, delta } of rows) {
    const row = accounts.get(account) ?? {
      account,
      estimate: 0,
      actual: 0,
      variance: 0,
      outstanding: 0,
    };
    row.actual += delta;
    row.variance = row.actual - row.estimate;
    accounts.set(account, row);
  }
  return { settled: usage.settled, accounts: [...accounts.values()] };
}
