// ---
// relationships:
//   implements: t3code-environment-source
//   realizes: t3code-source-database-schema
// ---
import type { OrchestrationThread } from "@wyrd-company/t3code-client";
import type { Store } from "../store/index.ts";
export interface ThreadRow {
  thread_id: string;
  status: "followed" | "archived" | "deleted";
  cursor: number;
  thread: OrchestrationThread | null;
  project_id: string | null;
}
export interface EnvironmentRow {
  environment_id: string;
  origin_sequence: number;
  shell_sequence: number;
}
export class SourceDefect extends Error {}
export function persistence(store: Store, environment: string) {
  const db = store.connection.database;
  function read<T>(query: () => T): T {
    try {
      return query();
    } catch (cause) {
      throw new SourceDefect("T3 source read failed", { cause });
    }
  }
  return {
    atomic<T>(work: () => T) {
      try {
        return store.connection.transaction(work);
      } catch (cause) {
        throw new SourceDefect("T3 source transaction failed", { cause });
      }
    },
    environment() {
      return read(
        () =>
          db
            .prepare("SELECT * FROM t3_environment WHERE environment = ?")
            .get(environment) as unknown as EnvironmentRow | undefined,
      );
    },
    reset() {
      db.prepare("DELETE FROM t3_environment WHERE environment = ?").run(environment);
    },
    initialize(server: string, sequence: number) {
      db.prepare("INSERT INTO t3_environment VALUES (?, ?, ?, ?)").run(
        environment,
        server,
        sequence,
        sequence,
      );
    },
    shell(sequence: number) {
      db.prepare(
        "UPDATE t3_environment SET shell_sequence = max(shell_sequence, ?) WHERE environment = ?",
      ).run(sequence, environment);
    },
    rows() {
      return read(
        () =>
          db
            .prepare("SELECT * FROM t3_thread WHERE environment = ?")
            .all(environment)
            .map((row) => ({
              ...row,
              thread: JSON.parse(String(row["thread"])),
            })) as unknown as ThreadRow[],
      );
    },
    row(id: string) {
      return read(() => {
        const row = db
          .prepare("SELECT * FROM t3_thread WHERE environment = ? AND thread_id = ?")
          .get(environment, id);
        return row
          ? ({ ...row, thread: JSON.parse(String(row["thread"])) } as unknown as ThreadRow)
          : undefined;
      });
    },
    save(
      id: string,
      status: ThreadRow["status"],
      cursor: number,
      thread: OrchestrationThread | null,
      projectId: OrchestrationThread["projectId"] | null = thread?.projectId ?? null,
    ) {
      db.prepare(
        "INSERT INTO t3_thread (environment, thread_id, status, cursor, thread, project_id) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (environment, thread_id) DO UPDATE SET status=excluded.status, cursor=excluded.cursor, thread=excluded.thread, project_id=coalesce(excluded.project_id, t3_thread.project_id)",
      ).run(environment, id, status, cursor, JSON.stringify(thread), projectId);
    },
  };
}
