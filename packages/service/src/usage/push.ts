// ---
// relationships:
//   implements: usage-intake
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import { LedgerError } from "../ledger/index.ts";
import type {
  UsageCall,
  UsageDeclaration,
  UsagePushRequest,
  UsagePushResult,
  UsageTokens,
} from "@wyrd-company/manifold-shared";
import { attribute } from "./attribution.ts";
import { priceEntry, priceGrowth } from "./pricing.ts";
import { zeroTokens } from "./types.ts";
import type { Posting, UsageOptions, UsageRetryResult } from "./types.ts";
function compareCopies(a: UsageCall, b: UsageCall): number {
  const time = Date.parse(a.timestamp) - Date.parse(b.timestamp);
  if (time) return time;
  const keys = Object.keys(zeroTokens()) as (keyof UsageTokens)[];
  const sum = keys.reduce((n, key) => n + a.tokens[key] - b.tokens[key], 0);
  if (sum) return sum;
  for (const key of keys) {
    const delta = a.tokens[key] - b.tokens[key];
    if (delta) return delta;
  }
  return 0;
}
export function resolvePosting(
  options: UsageOptions,
  declaration: UsageDeclaration,
  now: () => number,
  posting: Posting,
): "posted" | "unaccounted" | "unpriced" | "no-window" {
  const db = options.connection.database;
  const session = readUsageSessions(
    db
      .prepare(
        "SELECT CAST(provider_instance AS BLOB) AS provider_instance FROM usage_sessions WHERE environment=? AND provider=? AND provider_session_id=json_extract((SELECT record FROM usage_calls WHERE environment=? AND call_key=?),'$.providerSessionId')",
      )
      .get(posting.environment, posting.provider, posting.environment, posting.call_key),
  ) as { provider_instance: string | null } | undefined;
  let account: string | undefined, fallback: string | undefined;
  for (const [name, entry] of Object.entries(declaration.accounts).filter(
    ([, entry]) => !entry.archived,
  ))
    for (const usage of entry.usage ?? [])
      if (usage.environment === posting.environment && usage.provider === posting.provider) {
        if (usage.instance === undefined) fallback = name;
        else if (usage.instance === session?.provider_instance) account = name;
      }
  account ??= fallback;
  let reason: "unaccounted" | "unpriced" | "no-window" | undefined;
  let amount: number | undefined;
  if (!account) reason = "unaccounted";
  else {
    amount = priceGrowth(
      JSON.parse(posting.base_tokens) as UsageTokens,
      JSON.parse(posting.tokens) as UsageTokens,
      posting.provider,
      priceEntry(posting.model, declaration.prices),
      posting.speed,
    );
    if (amount === undefined) reason = "unpriced";
  }
  const key = `usage:${posting.environment}:${posting.call_key}:${posting.revision}`;
  if (!reason) {
    try {
      options.ledger.postActual({
        key,
        actor: posting.actor,
        item: posting.item,
        account: account!,
        amount: amount!,
        usedAt: posting.used_at,
      });
    } catch (error) {
      if (error instanceof LedgerError && error.code === "no-window") reason = "no-window";
      else throw error;
    }
  }
  if (reason) {
    db.prepare("UPDATE usage_postings SET account=?,amount=?,reason=? WHERE seq=?").run(
      account ?? null,
      amount ?? null,
      reason,
      posting.seq,
    );
    return reason;
  }
  db.prepare(
    "UPDATE usage_postings SET account=?,amount=?,status='posted',reason=NULL,ledger_key=?,posted_at=? WHERE seq=?",
  ).run(account!, amount!, key, now(), posting.seq);
  return "posted";
}
export function retryPostings(
  options: UsageOptions,
  declaration: UsageDeclaration,
  now: () => number,
): UsageRetryResult {
  return options.connection.transaction(() => {
    const result: UsageRetryResult = {
      posted: 0,
      pending: { unaccounted: 0, unpriced: 0, noWindow: 0 },
    };
    for (const posting of options.connection.database
      .prepare(
        "SELECT seq, CAST(environment AS BLOB) AS environment, CAST(call_key AS BLOB) AS call_key, revision, used_at, provider, CAST(model AS BLOB) AS model, speed, base_tokens, tokens, CAST(actor AS BLOB) AS actor, CAST(item AS BLOB) AS item, visit, CAST(account AS BLOB) AS account, amount, status, reason, CAST(ledger_key AS BLOB) AS ledger_key, posted_at FROM usage_postings WHERE status='pending' ORDER BY seq",
      )
      .all()
      .map(readUsagePostings) as Posting[]) {
      const status = resolvePosting(options, declaration, now, posting);
      if (status === "posted") result.posted++;
      else result.pending[status === "no-window" ? "noWindow" : status]++;
    }
    return result;
  });
}
export function postingAttribution(
  options: UsageOptions,
  environment: string,
  provider: string,
  sessionId: string,
  usedAt: number,
) {
  const db = options.connection.database;
  const session = readUsageSessionsThreadId(
    db
      .prepare(
        "SELECT CAST(thread_id AS BLOB) AS thread_id FROM usage_sessions WHERE environment=? AND provider=? AND provider_session_id=?",
      )
      .get(environment, provider, sessionId),
  ) as { thread_id: string } | undefined;
  const actor = session
    ? (readUsageThreads(
        db
          .prepare(
            "SELECT CAST(a.actor_id AS BLOB) AS actor_id, CAST(a.item AS BLOB) AS item FROM usage_threads t JOIN usage_actors a USING(actor_id) WHERE t.environment=? AND t.thread_id=?",
          )
          .get(environment, session.thread_id),
      ) as { actor_id: string; item: string | null } | undefined)
    : undefined;
  const visit = actor ? options.visits.visitAt(actor.actor_id, usedAt) : undefined;
  const project = session ? options.threadProject(environment, session.thread_id) : undefined;
  return attribute({
    environment,
    provider,
    session: sessionId,
    ...(session ? { thread: session.thread_id } : {}),
    ...(actor ? { actor: actor.actor_id, ...(actor.item ? { actorItem: actor.item } : {}) } : {}),
    ...(project
      ? {
          projectItem: options.portfolio.usageItem(
            options.portfolio.t3codeProject({
              environment,
              id: project,
            }).item,
          ),
        }
      : {}),
    ...(visit ? { visit } : {}),
  });
}
export function pushUsage(
  options: UsageOptions,
  declaration: UsageDeclaration,
  now: () => number,
  request: UsagePushRequest,
): UsagePushResult {
  return options.connection.transaction(() => {
    const db = options.connection.database;
    const result: UsagePushResult = {
      calls: { accepted: 0, pending: 0, replayed: 0 },
      threads: { accepted: 0, replayed: 0, conflicting: 0 },
      sourceErrors: 0,
    };
    for (const mapping of request.threads) {
      const previous = readUsageSessionsThreadIdProviderInstance(
        db
          .prepare(
            "SELECT CAST(thread_id AS BLOB) AS thread_id, CAST(provider_instance AS BLOB) AS provider_instance FROM usage_sessions WHERE environment=? AND provider=? AND provider_session_id=?",
          )
          .get(request.environment, mapping.provider, mapping.providerSessionId),
      ) as { thread_id: string; provider_instance: string | null } | undefined;
      if (previous) {
        result.threads[previous.thread_id === mapping.threadId ? "replayed" : "conflicting"]++;
      } else {
        db.prepare("INSERT INTO usage_sessions VALUES (?,?,?,?,?,?)").run(
          request.environment,
          mapping.provider,
          mapping.providerSessionId,
          mapping.threadId,
          mapping.providerInstance ?? null,
          now(),
        );
        result.threads.accepted++;
      }
    }
    for (const mapping of request.threads) {
      const sessionActor = `session:${request.environment}:${mapping.provider}:${mapping.providerSessionId}`;
      const postings = db
        .prepare(
          "SELECT p.seq AS seq, CAST(p.environment AS BLOB) AS environment, CAST(p.call_key AS BLOB) AS call_key, p.revision AS revision, p.used_at AS used_at, p.provider AS provider, CAST(p.model AS BLOB) AS model, p.speed AS speed, p.base_tokens AS base_tokens, p.tokens AS tokens, CAST(p.actor AS BLOB) AS actor, CAST(p.item AS BLOB) AS item, p.visit AS visit, CAST(p.account AS BLOB) AS account, p.amount AS amount, p.status AS status, p.reason AS reason, CAST(p.ledger_key AS BLOB) AS ledger_key, p.posted_at AS posted_at, CAST(p.attributed_actor AS BLOB) AS attributed_actor, CAST(p.attributed_item AS BLOB) AS attributed_item, CAST(p.held_actor AS BLOB) AS held_actor, CAST(p.held_item AS BLOB) AS held_item, p.attributed_visit AS attributed_visit, p.moves AS moves FROM usage_attributed_postings p JOIN usage_calls c USING(environment,call_key) WHERE p.environment=? AND p.provider=? AND json_extract(c.record,'$.providerSessionId')=? AND p.attributed_actor=? ORDER BY p.seq",
        )
        .all(request.environment, mapping.provider, mapping.providerSessionId, sessionActor)
        .map(readUsageAttributedPostings) as Posting[];
      for (const posting of postings) {
        const attribution = postingAttribution(
          options,
          request.environment,
          mapping.provider,
          mapping.providerSessionId,
          posting.used_at,
        );
        if (posting.status === "pending") {
          db.prepare("UPDATE usage_postings SET actor=?,item=?,visit=? WHERE seq=?").run(
            attribution.actor,
            attribution.item,
            attribution.visit,
            posting.seq,
          );
          resolvePosting(options, declaration, now, { ...posting, ...attribution });
        } else {
          db.prepare(
            "INSERT INTO usage_reattributions (posting,cause,actor,item,visit,recorded_at) VALUES (?,'mapping',?,?,?,?)",
          ).run(posting.seq, attribution.actor, attribution.item, attribution.visit, now());
        }
      }
    }
    for (const record of request.records) {
      if (record.type === "source-error") {
        db.prepare(
          "INSERT INTO usage_source_errors VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(environment,provider,source,code) DO UPDATE SET records=excluded.records,first_record=excluded.first_record,detail=excluded.detail,seen_at=excluded.seen_at",
        ).run(
          request.environment,
          record.provider,
          record.source,
          record.code,
          record.records,
          record.firstRecord ?? null,
          record.detail ?? null,
          now(),
        );
        result.sourceErrors++;
        continue;
      }
      const previous = db
        .prepare(
          "SELECT record,charged,revision FROM usage_calls WHERE environment=? AND call_key=?",
        )
        .get(request.environment, record.key) as
        | { record: string; charged: string; revision: number }
        | undefined;
      const base: UsageTokens = previous
        ? (JSON.parse(previous.charged) as UsageTokens)
        : zeroTokens();
      const charged = { ...record.tokens },
        added = { ...record.tokens };
      for (const key of Object.keys(base) as (keyof UsageTokens)[]) {
        charged[key] = Math.max(base[key], record.tokens[key]);
        added[key] = charged[key] - base[key];
      }
      if (
        previous &&
        (record.granularity === "call" || Object.values(added).every((n) => n === 0))
      ) {
        result.calls.replayed++;
        continue;
      }
      const revision = (previous?.revision ?? 0) + 1;
      const display =
        previous && compareCopies(record, JSON.parse(previous.record) as UsageCall) <= 0
          ? previous.record
          : JSON.stringify(record);
      db.prepare(
        "INSERT INTO usage_calls VALUES (?,?,?,?,?,?) ON CONFLICT(environment,call_key) DO UPDATE SET record=excluded.record,charged=excluded.charged,revision=excluded.revision",
      ).run(request.environment, record.key, display, JSON.stringify(charged), revision, now());
      const usedAt = Date.parse(record.timestamp);
      const attribution = postingAttribution(
        options,
        request.environment,
        record.provider,
        record.providerSessionId,
        usedAt,
      );
      db.prepare(
        "INSERT INTO usage_postings (environment,call_key,revision,used_at,provider,model,speed,base_tokens,tokens,actor,item,visit,status,reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending','unaccounted')",
      ).run(
        request.environment,
        record.key,
        revision,
        usedAt,
        record.provider,
        record.model,
        record.speed,
        JSON.stringify(base),
        JSON.stringify(added),
        attribution.actor,
        attribution.item,
        attribution.visit,
      );
      const posting = readUsagePostings(
        db
          .prepare(
            "SELECT seq, CAST(environment AS BLOB) AS environment, CAST(call_key AS BLOB) AS call_key, revision, used_at, provider, CAST(model AS BLOB) AS model, speed, base_tokens, tokens, CAST(actor AS BLOB) AS actor, CAST(item AS BLOB) AS item, visit, CAST(account AS BLOB) AS account, amount, status, reason, CAST(ledger_key AS BLOB) AS ledger_key, posted_at FROM usage_postings WHERE environment=? AND call_key=? AND revision=?",
          )
          .get(request.environment, record.key, revision),
      ) as Posting;
      if (resolvePosting(options, declaration, now, posting) === "posted") result.calls.accepted++;
      else result.calls.pending++;
    }
    return result;
  });
}

function readUsageSessions<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    provider_instance:
      values["provider_instance"] === null ? null : storedText(values["provider_instance"]!),
  } as T;
}
function readUsagePostings<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    environment: storedText(values["environment"]!),
    call_key: storedText(values["call_key"]!),
    model: values["model"] === null ? null : storedText(values["model"]!),
    actor: storedText(values["actor"]!),
    item: storedText(values["item"]!),
    account: values["account"] === null ? null : storedText(values["account"]!),
    ledger_key: values["ledger_key"] === null ? null : storedText(values["ledger_key"]!),
  } as T;
}
function readUsageSessionsThreadId<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return { ...values, thread_id: storedText(values["thread_id"]!) } as T;
}
function readUsageThreads<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    actor_id: storedText(values["actor_id"]!),
    item: values["item"] === null ? null : storedText(values["item"]!),
  } as T;
}
function readUsageSessionsThreadIdProviderInstance<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    thread_id: storedText(values["thread_id"]!),
    provider_instance:
      values["provider_instance"] === null ? null : storedText(values["provider_instance"]!),
  } as T;
}
function readUsageAttributedPostings<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    environment: storedText(values["environment"]!),
    call_key: storedText(values["call_key"]!),
    model: values["model"] === null ? null : storedText(values["model"]!),
    actor: storedText(values["actor"]!),
    item: storedText(values["item"]!),
    account: values["account"] === null ? null : storedText(values["account"]!),
    ledger_key: values["ledger_key"] === null ? null : storedText(values["ledger_key"]!),
    attributed_actor: storedText(values["attributed_actor"]!),
    attributed_item: storedText(values["attributed_item"]!),
    held_actor: storedText(values["held_actor"]!),
    held_item: storedText(values["held_item"]!),
  } as T;
}
