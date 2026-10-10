// ---
// relationships:
//   implements: t3code-environment-source
//   realizes: t3code-source-database-schema
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import type { OrchestrationThread } from "@wyrd-company/t3code-client";
import { emptyAttribution } from "./state.ts";
import type { TurnAttribution } from "./state.ts";
import type { Store } from "../store/index.ts";
export interface ThreadRow {
  thread_id: string;
  status: "followed" | "archived" | "deleted";
  cursor: number;
  thread: OrchestrationThread | null;
  project_id: string | null;
  attribution: TurnAttribution;
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
          readT3Environment(
            db
              .prepare(
                "SELECT CAST(environment AS BLOB) AS environment, CAST(environment_id AS BLOB) AS environment_id, origin_sequence, shell_sequence FROM t3_environment WHERE environment = ?",
              )
              .get(environment),
          ) as unknown as EnvironmentRow | undefined,
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
            .prepare(
              "SELECT CAST(environment AS BLOB) AS environment, CAST(thread_id AS BLOB) AS thread_id, status, cursor, thread, CAST(project_id AS BLOB) AS project_id, attribution FROM t3_thread WHERE environment = ?",
            )
            .all(environment)
            .map(readT3Thread)
            .map((row) => ({
              ...row,
              thread: JSON.parse(String(row["thread"])),
              attribution: JSON.parse(String(row["attribution"])),
            })) as unknown as ThreadRow[],
      );
    },
    row(id: string) {
      return read(() => {
        const row = readT3Thread(
          db
            .prepare(
              "SELECT CAST(environment AS BLOB) AS environment, CAST(thread_id AS BLOB) AS thread_id, status, cursor, thread, CAST(project_id AS BLOB) AS project_id, attribution FROM t3_thread WHERE environment = ? AND thread_id = ?",
            )
            .get(environment, id),
        );
        return row
          ? ({
              ...row,
              thread: JSON.parse(String(row["thread"])),
              attribution: JSON.parse(String(row["attribution"])),
            } as unknown as ThreadRow)
          : undefined;
      });
    },
    save(
      id: string,
      status: ThreadRow["status"],
      cursor: number,
      thread: OrchestrationThread | null,
      projectId: OrchestrationThread["projectId"] | null = thread?.projectId ?? null,
      attribution?: TurnAttribution,
    ) {
      db.prepare(
        "INSERT INTO t3_thread (environment, thread_id, status, cursor, thread, project_id, attribution) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (environment, thread_id) DO UPDATE SET status=excluded.status, cursor=excluded.cursor, thread=excluded.thread, project_id=coalesce(excluded.project_id, t3_thread.project_id), attribution=excluded.attribution",
      ).run(
        environment,
        id,
        status,
        cursor,
        JSON.stringify(thread),
        projectId,
        JSON.stringify(attribution ?? this.row(id)?.attribution ?? emptyAttribution),
      );
    },
  };
}

function readT3Environment<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    environment: storedText(values["environment"]!),
    environment_id: storedText(values["environment_id"]!),
  } as T;
}
function readT3Thread<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    environment: storedText(values["environment"]!),
    thread_id: storedText(values["thread_id"]!),
    project_id: values["project_id"] === null ? null : storedText(values["project_id"]!),
  } as T;
}
