// ---
// relationships:
//   implements: [usage-intake, actor-usage-api]
// ---
import type {
  ActorUsageResponse,
  ActorTokens,
} from "@wyrd-company/manifold-shared/actor-usage-api";
import type { UsageTokens } from "@wyrd-company/manifold-shared";
import type { UsageOptions } from "./types.ts";
interface Row {
  seq: number;
  provider: string;
  tokens: string;
  visit: number | null;
  account: string | null;
  amount: number | null;
  status: string;
  used_at: number;
  environment: string;
  thread_id: string | null;
}
const zero = (): ActorTokens => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  reasoning: 0,
  total: 0,
});
export function visitUsage(
  actorId: string,
  rows: readonly Row[],
  visits: readonly { visit: number; enteredAt: string }[],
  units: Readonly<Record<string, string>>,
): ActorUsageResponse {
  const sum = (group: readonly Row[]) => {
    const tokens = { ...zero() },
      accounts = new Map<string, number>();
    for (const row of group) {
      const t = JSON.parse(row.tokens) as UsageTokens;
      for (const key of ["input", "output", "cacheRead", "cacheWrite", "reasoning"] as const)
        tokens[key] += t[key];
      tokens.total +=
        t.input +
        t.output +
        t.cacheRead +
        t.cacheWrite +
        (row.provider === "codex" ? 0 : t.reasoning);
      if (row.status === "posted" && row.account !== null)
        accounts.set(row.account, (accounts.get(row.account) ?? 0) + (row.amount ?? 0));
    }
    return {
      tokens,
      accounts: [...accounts]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([account, actual]) => ({ account, actual })),
    };
  };
  const total = sum(rows);
  return {
    actorId,
    ...total,
    accounts: total.accounts.map((a) => ({
      ...a,
      ...(units[a.account] === undefined ? {} : { unit: units[a.account] }),
    })),
    visits: visits
      .filter((v) => rows.some((r) => r.visit === v.visit))
      .map((v) => ({
        visit: v.visit,
        enteredAt: v.enteredAt,
        ...sum(rows.filter((r) => r.visit === v.visit)),
      })),
    calls: rows
      .toSorted((a, b) => a.used_at - b.used_at || a.seq - b.seq)
      .map((row) => ({
        usedAt: new Date(row.used_at).toISOString(),
        thread:
          row.thread_id === null ? null : { environment: row.environment, threadId: row.thread_id },
        visit: row.visit,
        total: sum([row]).tokens.total,
        account: row.status === "posted" ? row.account : null,
        actual: row.status === "posted" ? row.amount : null,
      })),
  };
}
export function actorVisitUsage(
  options: UsageOptions,
  actor: string,
  units: Readonly<Record<string, string>>,
): ActorUsageResponse {
  const rows = options.connection.database
    .prepare(
      `SELECT p.seq, p.provider, p.tokens, p.attributed_visit AS visit,
         p.account, p.amount, p.status, p.used_at, p.environment, s.thread_id
       FROM usage_attributed_postings p
       JOIN usage_calls c ON c.environment=p.environment AND c.call_key=p.call_key
       LEFT JOIN usage_sessions s ON s.environment=p.environment AND s.provider=p.provider
         AND s.provider_session_id=json_extract(c.record,'$.providerSessionId')
       WHERE p.attributed_actor=?
       ORDER BY p.used_at, p.seq`,
    )
    .all(actor) as unknown as Row[];
  return visitUsage(actor, rows, options.visits.visits(actor), units);
}
