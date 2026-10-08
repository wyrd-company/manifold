// ---
// relationships:
//   implements: operator-console
// ---
// Structural stand-in for the environment control seam; replaced at Rebase.
export interface EnvironmentSummary {
  readonly name: string;
  readonly host: string;
  readonly status: "connected" | "connecting" | "disconnected" | "paused";
  readonly activeThreads: number | null;
  readonly scheduledThreads: number;
}
export type EnvironmentsResult =
  | { kind: "ok"; environments: readonly EnvironmentSummary[] }
  | { kind: "failed"; message: string };
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const natural = (v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0;
export function isEnvironmentsResponse(
  v: unknown,
): v is { environments: readonly EnvironmentSummary[] } {
  return (
    record(v) &&
    Object.keys(v).length === 1 &&
    Array.isArray(v["environments"]) &&
    v["environments"].every(
      (e) =>
        record(e) &&
        Object.keys(e).length === 5 &&
        typeof e["name"] === "string" &&
        typeof e["host"] === "string" &&
        ["connected", "connecting", "disconnected", "paused"].includes(String(e["status"])) &&
        (e["activeThreads"] === null || natural(e["activeThreads"])) &&
        natural(e["scheduledThreads"]),
    )
  );
}
export function mapEnvironmentsResult(status: number, body: unknown): EnvironmentsResult {
  return status === 200 && isEnvironmentsResponse(body)
    ? { kind: "ok", environments: body.environments }
    : { kind: "failed", message: "Cannot read environments. Check the connection and try again." };
}
export async function fetchEnvironments(): Promise<EnvironmentsResult> {
  try {
    const response = await fetch("/api/environments");
    return mapEnvironmentsResult(
      response.status,
      response.status === 200 ? await response.json() : null,
    );
  } catch {
    return mapEnvironmentsResult(0, undefined);
  }
}
