// ---
// relationships:
//   implements: usage-intake
// ---
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
  const session = db
    .prepare(
      "SELECT provider_instance FROM usage_sessions WHERE environment=? AND provider=? AND provider_session_id=json_extract((SELECT record FROM usage_calls WHERE environment=? AND call_key=?),'$.providerSessionId')",
    )
    .get(posting.environment, posting.provider, posting.environment, posting.call_key) as
    | { provider_instance: string | null }
    | undefined;
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
      .prepare("SELECT * FROM usage_postings WHERE status='pending' ORDER BY seq")
      .all() as Posting[]) {
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
  const session = db
    .prepare(
      "SELECT thread_id FROM usage_sessions WHERE environment=? AND provider=? AND provider_session_id=?",
    )
    .get(environment, provider, sessionId) as { thread_id: string } | undefined;
  const actor = session
    ? (db
        .prepare(
          "SELECT a.actor_id,a.item FROM usage_threads t JOIN usage_actors a USING(actor_id) WHERE t.environment=? AND t.thread_id=?",
        )
        .get(environment, session.thread_id) as
        | { actor_id: string; item: string | null }
        | undefined)
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
          projectItem: options.portfolio.t3codeProject({
            environment,
            id: project,
          }).item,
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
      const previous = db
        .prepare(
          "SELECT thread_id,provider_instance FROM usage_sessions WHERE environment=? AND provider=? AND provider_session_id=?",
        )
        .get(request.environment, mapping.provider, mapping.providerSessionId) as
        | { thread_id: string; provider_instance: string | null }
        | undefined;
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
          "SELECT p.* FROM usage_attributed_postings p JOIN usage_calls c USING(environment,call_key) WHERE p.environment=? AND p.provider=? AND json_extract(c.record,'$.providerSessionId')=? AND p.attributed_actor=? ORDER BY p.seq",
        )
        .all(
          request.environment,
          mapping.provider,
          mapping.providerSessionId,
          sessionActor,
        ) as Posting[];
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
      const posting = db
        .prepare("SELECT * FROM usage_postings WHERE environment=? AND call_key=? AND revision=?")
        .get(request.environment, record.key, revision) as Posting;
      if (resolvePosting(options, declaration, now, posting) === "posted") result.calls.accepted++;
      else result.calls.pending++;
    }
    return result;
  });
}
