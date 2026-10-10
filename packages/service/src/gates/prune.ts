// ---
// relationships:
//   implements: gate-runtime
// ---
import type { StoreConnection } from "../store/index.ts";
export function pruneGateEvaluations(
  connection: StoreConnection,
  request: {
    readonly evaluatedBefore: number;
    readonly keepGates: ReadonlySet<string>;
    readonly limit: number;
  },
): number {
  const gates = [...request.keepGates];
  return connection.transaction(() =>
    Number(
      connection.database
        .prepare(`DELETE FROM gates_evaluation WHERE evaluation_id IN (
    SELECT evaluation_id FROM gates_evaluation e WHERE evaluated_at < ?
    AND NOT EXISTS (SELECT 1 FROM gates_token t WHERE t.evaluation_id=e.evaluation_id AND t.returned_at IS NULL)
    ${gates.length ? `AND gate NOT IN (${gates.map(() => "?").join(",")})` : ""}
    ORDER BY evaluated_at,evaluation_id LIMIT ?)`)
        .run(request.evaluatedBefore, ...gates, request.limit).changes,
    ),
  );
}
