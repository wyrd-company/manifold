// ---
// relationships:
//   implements: usage-intake
//   references: t3code-environment-source
// ---
import type { LedgerConnection } from "../ledger/index.ts";
export function readThreadProject(
  connection: LedgerConnection,
  environment: string,
  threadId: string,
): string | undefined {
  const row = connection.database
    .prepare("SELECT project_id FROM t3_thread WHERE environment=? AND thread_id=?")
    .get(environment, threadId) as { project_id: string | null } | undefined;
  return row?.project_id ?? undefined;
}
