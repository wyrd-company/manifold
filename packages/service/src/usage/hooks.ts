// ---
// relationships:
//   implements: usage-intake
// ---
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
            "SELECT p.*,json_extract(c.record,'$.providerSessionId') AS session FROM usage_attributed_postings p JOIN usage_calls c USING(environment,call_key) WHERE p.attributed_actor=? ORDER BY p.seq",
          )
          .all(`thread:${environment}:${thread}`) as (Posting & { session: string })[];
        for (const posting of postings) {
          const attribution = postingAttribution(
            options,
            environment,
            posting.provider,
            posting.session,
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
