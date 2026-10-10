// ---
// relationships:
//   implements: [usage-intake, usage-api]
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import { isUnownedActor } from "@wyrd-company/manifold-shared/usage-api";
import type { UnownedEntry } from "@wyrd-company/manifold-shared/usage-api";
import type { UsageOptions } from "./types.ts";
export function unownedUsage(options: UsageOptions): UnownedEntry[] {
  const rows = options.connection.database
    .prepare(
      "SELECT CAST(attributed_actor AS BLOB) AS attributed_actor, CAST(environment AS BLOB) AS environment, provider, CAST(json_extract(c.record,'$.providerSessionId') AS BLOB) AS session, used_at, status, reason, CAST(held_item AS BLOB) AS held_item, CAST(account AS BLOB) AS account, amount FROM usage_attributed_postings p JOIN usage_calls c USING(environment,call_key) ORDER BY used_at DESC,p.seq DESC",
    )
    .all()
    .map(readUsageAttributedPostings) as {
    attributed_actor: string;
    environment: string;
    provider: string;
    session: string;
    used_at: number;
    status: string;
    reason: string | null;
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
        unmetered: 0,
        usage: [],
        ...(threadId ? { threadId } : { provider: row.provider, providerSessionId: row.session }),
        ...(project ? { project } : {}),
        ...(title !== undefined ? { title } : {}),
      };
      entries.set(actor, entry);
    }
    if (row.reason === "unmetered") entry.unmetered++;
    else if (row.status === "pending") entry.pending++;
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

function readUsageAttributedPostings<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    attributed_actor: storedText(values["attributed_actor"]!),
    environment: storedText(values["environment"]!),
    session: storedText(values["session"]!),
    held_item: storedText(values["held_item"]!),
    account: values["account"] === null ? null : storedText(values["account"]!),
  } as T;
}
