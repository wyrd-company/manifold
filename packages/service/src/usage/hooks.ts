// ---
// relationships:
//   implements: usage-intake
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import { postingAttribution, resolvePosting } from "./push.ts";
import type { UsageDeclaration } from "@wyrd-company/manifold-shared";
import type { Posting } from "./types.ts";
import type { UsageActorSave, UsageOptions } from "./types.ts";
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown) => (typeof value === "string" ? value : null);
export function saveActor(
  options: UsageOptions,
  now: () => number,
  save: UsageActorSave,
  declaration: UsageDeclaration,
): void {
  if (save.snapshot.status === "error") return;
  options.connection.transaction(() => {
    const db = options.connection.database;
    const identity = object(object(save.snapshot.context)["manifold"]);
    const environment = string(identity["environment"]),
      item = string(identity["portfolioItem"]);
    db.prepare(
      "INSERT INTO usage_actors (actor_id,environment,item) VALUES (?,?,?) ON CONFLICT(actor_id) DO UPDATE SET environment=excluded.environment,item=excluded.item",
    ).run(save.actorId, environment, item);
    if (environment && Array.isArray(identity["threads"]))
      for (const thread of identity["threads"]) {
        if (typeof thread !== "string") continue;
        const inserted = db
          .prepare("INSERT OR IGNORE INTO usage_threads VALUES (?,?,?)")
          .run(environment, thread, save.actorId) as { changes: number | bigint };
        if (!inserted.changes) continue;
        const postings = db
          .prepare(
            "SELECT p.seq AS seq, CAST(p.environment AS BLOB) AS environment, CAST(p.call_key AS BLOB) AS call_key, p.revision AS revision, p.used_at AS used_at, p.provider AS provider, CAST(p.model AS BLOB) AS model, p.speed AS speed, p.base_tokens AS base_tokens, p.tokens AS tokens, CAST(p.actor AS BLOB) AS actor, CAST(p.item AS BLOB) AS item, p.visit AS visit, CAST(p.account AS BLOB) AS account, p.amount AS amount, p.status AS status, p.reason AS reason, CAST(p.ledger_key AS BLOB) AS ledger_key, p.posted_at AS posted_at, CAST(p.attributed_actor AS BLOB) AS attributed_actor, CAST(p.attributed_item AS BLOB) AS attributed_item, CAST(p.held_actor AS BLOB) AS held_actor, CAST(p.held_item AS BLOB) AS held_item, p.attributed_visit AS attributed_visit, p.moves AS moves, CAST(json_extract(c.record,'$.providerSessionId') AS BLOB) AS session FROM usage_attributed_postings p JOIN usage_calls c USING(environment,call_key) WHERE p.attributed_actor=? ORDER BY p.seq",
          )
          .all(`thread:${environment}:${thread}`)
          .map(readUsageAttributedPostings) as (Posting & { session: string })[];
        for (const posting of postings) {
          const attribution = postingAttribution(
            options,
            environment,
            posting.provider,
            posting.session,
            posting.used_at,
          );
          const movedUnmetered = posting.reason === "unmetered" && (posting.moves ?? 0) > 0;
          if (posting.status === "pending" && !movedUnmetered) {
            db.prepare("UPDATE usage_postings SET actor=?,item=?,visit=? WHERE seq=?").run(
              attribution.actor,
              attribution.item,
              attribution.visit,
              posting.seq,
            );
            resolvePosting(options, declaration, now, { ...posting, ...attribution });
          } else {
            if (posting.status === "pending")
              resolvePosting(options, declaration, now, { ...posting, ...attribution });
            db.prepare(
              "INSERT INTO usage_reattributions (posting,cause,actor,item,visit,recorded_at) VALUES (?,'ownership',?,?,?,?)",
            ).run(posting.seq, attribution.actor, attribution.item, attribution.visit, now());
          }
        }
      }
    if (save.snapshot.status === "done" || save.snapshot.status === "stopped") {
      db.prepare("UPDATE usage_actors SET ended_at=coalesce(ended_at,?) WHERE actor_id=?").run(
        now(),
        save.actorId,
      );
      options.ledger.settle({ actor: save.actorId });
    }
  });
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
    session: storedText(values["session"]!),
  } as T;
}
