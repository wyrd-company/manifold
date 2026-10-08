// ---
// relationships:
//   implements: [usage-intake, usage-api]
// ---
import { isUnownedActor } from "@wyrd-company/manifold-shared/usage-api";
import type { UnownedEntry } from "@wyrd-company/manifold-shared/usage-api";
import type { UsageOptions } from "./types.ts";
export function unownedUsage(options: UsageOptions): UnownedEntry[] {
  const rows = options.connection.database
    .prepare(
      "SELECT attributed_actor,environment,provider,json_extract(c.record,'$.providerSessionId') AS session,used_at,status,held_item,account,amount FROM usage_attributed_postings p JOIN usage_calls c USING(environment,call_key) ORDER BY used_at DESC,p.seq DESC",
    )
    .all() as {
    attributed_actor: string;
    environment: string;
    provider: string;
    session: string;
    used_at: number;
    status: string;
    held_item: string;
    account: string | null;
    amount: number | null;
  }[];
  const entries = new Map<string, UnownedEntry>();
  for (const row of rows) {
    const actor = row.attributed_actor;
    if (!isUnownedActor(actor)) continue;
    let entry = entries.get(actor);
    if (!entry) {
      const kind = actor.startsWith("thread:") ? "thread" : "session";
      const threadId =
        kind === "thread" ? actor.slice(`thread:${row.environment}:`.length) : undefined;
      const project = threadId ? options.threadProject(row.environment, threadId) : undefined;
      const title = threadId ? options.threadTitle?.(row.environment, threadId) : undefined;
      entry = {
        actor,
        kind,
        environment: row.environment,
        lastUsedAt: new Date(row.used_at).toISOString(),
        pending: 0,
        usage: [],
        ...(threadId ? { threadId } : { provider: row.provider, providerSessionId: row.session }),
        ...(project ? { project } : {}),
        ...(title !== undefined ? { title } : {}),
      };
      entries.set(actor, entry);
    }
    if (row.status === "pending") entry.pending++;
    else {
      let group = entry.usage.find((g) => g.item === row.held_item && g.account === row.account);
      if (!group) {
        group = { item: row.held_item, account: row.account!, amount: 0, calls: 0 };
        entry.usage.push(group);
      }
      group.amount += row.amount!;
      group.calls++;
    }
  }
  for (const entry of entries.values())
    entry.usage.sort((a, b) => a.item.localeCompare(b.item) || a.account.localeCompare(b.account));
  return [...entries.values()].sort(
    (a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt) || a.actor.localeCompare(b.actor),
  );
}
