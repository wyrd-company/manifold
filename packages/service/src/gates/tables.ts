// ---
// relationships:
//   implements: gate-runtime
//   realizes: gates-database-schema
// ---
import { canonicalJson } from "./values.ts";
import type { Store } from "../store/index.ts";
import type {
  EntryRow,
  TokenRow,
  EvaluationRow,
  GateEvaluationResult,
  GateInput,
} from "./types.ts";
export function gateTables(store: Store, now: () => number) {
  const db = store.connection.database;
  return {
    declarations: () =>
      db.prepare("SELECT * FROM gates_declaration ORDER BY gate").all() as unknown as {
        gate: string;
        version: string;
        revision_commit: string;
      }[],
    declare: (gate: string, version: string, commit: string) =>
      db
        .prepare(
          "INSERT INTO gates_declaration VALUES (?,?,?,?) ON CONFLICT(gate) DO UPDATE SET version=excluded.version,revision_commit=excluded.revision_commit,declared_at=excluded.declared_at",
        )
        .run(gate, version, commit, now()),
    entry: (gate: string, actor: string) =>
      db
        .prepare("SELECT * FROM gates_entry WHERE gate=? AND actor_id=?")
        .get(gate, actor) as unknown as EntryRow | undefined,
    enter: (gate: string, actor: string, id: string | null, time = now()) =>
      db
        .prepare(
          "INSERT INTO gates_entry (gate,actor_id,state_entry_id,entered_at) VALUES (?,?,?,?)",
        )
        .run(gate, actor, id, time),
    exit: (gate: string, actor: string) =>
      db.prepare("DELETE FROM gates_entry WHERE gate=? AND actor_id=?").run(gate, actor),
    adopt: (entry: EntryRow, id: string) => {
      db.prepare("UPDATE gates_entry SET state_entry_id=? WHERE entry_id=?").run(
        id,
        entry.entry_id,
      );
      db.prepare(
        "UPDATE gates_token SET state_entry_id=? WHERE entry_id=? AND state_entry_id IS NULL",
      ).run(id, entry.entry_id);
    },
    holders: (gate: string) =>
      db
        .prepare("SELECT * FROM gates_token WHERE gate=? AND returned_at IS NULL ORDER BY actor_id")
        .all(gate) as unknown as TokenRow[],
    actorTokens: (actor: string) =>
      db
        .prepare(
          "SELECT * FROM gates_token WHERE actor_id=? AND returned_at IS NULL ORDER BY token_id",
        )
        .all(actor) as unknown as TokenRow[],
    token: (id: string) =>
      db.prepare("SELECT * FROM gates_token WHERE token_id=?").get(id) as unknown as
        | TokenRow
        | undefined,
    granted: (entry: number) =>
      Boolean(db.prepare("SELECT 1 FROM gates_token WHERE entry_id=?").get(entry)),
    grant: (entry: EntryRow, evaluation: number) =>
      db
        .prepare(
          "INSERT INTO gates_token (token_id,gate,actor_id,entry_id,state_entry_id,evaluation_id,granted_at) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          `token:${entry.entry_id}`,
          entry.gate,
          entry.actor_id,
          entry.entry_id,
          entry.state_entry_id,
          evaluation,
          now(),
        ),
    returnToken: (id: string, reason: "ended" | "return-point" | "escalation", state: string) =>
      db
        .prepare(
          "UPDATE gates_token SET returned_at=?,return_reason=?,return_state=? WHERE token_id=? AND returned_at IS NULL",
        )
        .run(now(), reason, state, id).changes !== 0,
    trap: (id: string, trapped: boolean) =>
      db.prepare("UPDATE gates_token SET trapped=? WHERE token_id=?").run(Number(trapped), id),
    evaluate: (
      gate: string,
      version: string,
      input: GateInput,
      seed: number,
      result: GateEvaluationResult,
    ) =>
      Number(
        db
          .prepare(
            "INSERT INTO gates_evaluation (gate,version,evaluated_at,seed,input,outcome,selection,failure_kind,failure_message,duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?)",
          )
          .run(
            gate,
            version,
            now(),
            seed,
            canonicalJson(input),
            result.ok ? (result.selection === null ? "none" : "selection") : "failure",
            result.ok && result.selection !== null ? canonicalJson(result.selection) : null,
            result.ok ? null : result.failure.kind,
            result.ok ? null : result.failure.message,
            result.durationMs,
          ).lastInsertRowid,
      ),
    evaluation: (id: number) =>
      db.prepare("SELECT * FROM gates_evaluation WHERE evaluation_id=?").get(id) as unknown as
        | EvaluationRow
        | undefined,
  };
}
export type GateTables = ReturnType<typeof gateTables>;
