// ---
// relationships:
//   implements: usage-intake
// ---
import { canonical } from "./types.ts";
import type { UsageActorSave, UsageOptions } from "./types.ts";
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const string = (value: unknown) => (typeof value === "string" ? value : null);
export function saveActor(options: UsageOptions, now: () => number, save: UsageActorSave): void {
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
      for (const thread of identity["threads"])
        if (typeof thread === "string")
          db.prepare("INSERT OR IGNORE INTO usage_threads VALUES (?,?,?)").run(
            environment,
            thread,
            save.actorId,
          );
    const latest = db
      .prepare(
        "SELECT visit,state_value FROM usage_visits WHERE actor_id=? ORDER BY visit DESC LIMIT 1",
      )
      .get(save.actorId) as { visit: number; state_value: string } | undefined;
    const value = canonical(save.snapshot.value);
    if (!latest || latest.state_value !== value)
      db.prepare("INSERT INTO usage_visits VALUES (?,?,?,?)").run(
        save.actorId,
        (latest?.visit ?? 0) + 1,
        value,
        now(),
      );
    if (save.snapshot.status === "done" || save.snapshot.status === "stopped") {
      db.prepare("UPDATE usage_actors SET ended_at=coalesce(ended_at,?) WHERE actor_id=?").run(
        now(),
        save.actorId,
      );
      options.ledger.settle({ actor: save.actorId });
    }
  });
}
