// ---
// relationships:
//   implements: epics-api
// ---
import {
  epicsApiPath,
  isEpicResponse,
  isEpicRootsResponse,
} from "@wyrd-company/manifold-shared/epics-api";
import type { Epic, EpicRootsResponse } from "@wyrd-company/manifold-shared/epics-api";
type Failed = { kind: "failed"; message: string };
export type EpicResult = { kind: "ok"; epic: Epic } | { kind: "missing" } | Failed;
export type EpicRootsResult = { kind: "ok"; roots: EpicRootsResponse["roots"] } | Failed;
const failed = (): Failed => ({
  kind: "failed",
  message: "Cannot read epics. Check the connection and try again.",
});
export function mapEpicRootsResult(status: number, body: unknown): EpicRootsResult {
  return status === 200 && isEpicRootsResponse(body) ? { kind: "ok", roots: body.roots } : failed();
}
export function mapEpicResult(status: number, body: unknown): EpicResult {
  return status === 404
    ? { kind: "missing" }
    : status === 200 && isEpicResponse(body)
      ? { kind: "ok", epic: body.epic }
      : failed();
}
export async function fetchEpicRoots(): Promise<EpicRootsResult> {
  try {
    const r = await fetch(epicsApiPath);
    return mapEpicRootsResult(r.status, r.status === 200 ? await r.json() : null);
  } catch {
    return failed();
  }
}
export async function fetchEpic(nodeId: string): Promise<EpicResult> {
  try {
    const r = await fetch(`${epicsApiPath}/${encodeURIComponent(nodeId)}`);
    return mapEpicResult(r.status, r.status === 200 ? await r.json() : null);
  } catch {
    return failed();
  }
}
