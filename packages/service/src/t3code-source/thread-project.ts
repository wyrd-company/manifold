// ---
// relationships:
//   implements: usage-intake
//   references: t3code-environment-source
// ---
import type { SQLOutputValue } from "node:sqlite";
import { storedText } from "../store/index.ts";
import type { LedgerConnection } from "../ledger/index.ts";
export function readThreadProject(
  connection: LedgerConnection,
  environment: string,
  threadId: string,
): string | undefined {
  const row = readT3Thread(
    connection.database
      .prepare(
        "SELECT CAST(project_id AS BLOB) AS project_id FROM t3_thread WHERE environment=? AND thread_id=?",
      )
      .get(environment, threadId),
  ) as { project_id: string | null } | undefined;
  return row?.project_id ?? undefined;
}

function readT3Thread<T>(row: T): T {
  if (row === undefined) return row;
  const values = row as Record<string, SQLOutputValue>;
  return {
    ...values,
    project_id: values["project_id"] === null ? null : storedText(values["project_id"]!),
  } as T;
}
