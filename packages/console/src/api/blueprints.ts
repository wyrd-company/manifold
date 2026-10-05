// ---
// relationships:
//   implements: [blueprints-api, operator-console]
// ---
import {
  blueprintsApiPath,
  isBlueprintsResponse,
  isBlueprintSourceResponse,
  isLintResponse,
  isSaveBlueprintResponse,
  isSaveConflictResponse,
} from "@wyrd-company/manifold-shared/blueprints-api";
import type {
  BlueprintsResponse,
  BlueprintSourceResponse,
  LintResponse,
  SaveBlueprintResponse,
  SaveConflictResponse,
  SaveBlueprintRequest,
} from "@wyrd-company/manifold-shared/blueprints-api";
type Bodies = {
  list: BlueprintsResponse;
  source: BlueprintSourceResponse;
  lint: LintResponse;
  save: SaveBlueprintResponse;
};
export type BlueprintResult<T> =
  | { kind: "ok"; body: T }
  | { kind: "conflict"; body: SaveConflictResponse }
  | { kind: "invalid"; body: LintResponse; message: string }
  | { kind: "failed"; message: string };
const guards = {
  list: isBlueprintsResponse,
  source: isBlueprintSourceResponse,
  lint: isLintResponse,
  save: isSaveBlueprintResponse,
};
export function mapBlueprintResult<K extends keyof Bodies>(
  operation: K,
  status: number,
  body: unknown,
): BlueprintResult<Bodies[K]> {
  if (status === 200 && guards[operation](body)) return { kind: "ok", body: body as Bodies[K] };
  if (status === 409 && isSaveConflictResponse(body)) return { kind: "conflict", body };
  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : "Cannot read blueprints. Check the connection and try again.";
  if (
    status === 422 &&
    typeof body === "object" &&
    body !== null &&
    "findings" in body &&
    "warnings" in body &&
    isLintResponse({ findings: body.findings, warnings: body.warnings })
  )
    return {
      kind: "invalid",
      body: {
        findings: body.findings as LintResponse["findings"],
        warnings: body.warnings as LintResponse["warnings"],
      },
      message,
    };
  return { kind: "failed", message };
}
async function request<K extends keyof Bodies>(
  operation: K,
  path: string,
  init?: RequestInit,
): Promise<BlueprintResult<Bodies[K]>> {
  try {
    const response = await fetch(blueprintsApiPath + path, init);
    return mapBlueprintResult(operation, response.status, await response.json());
  } catch {
    return {
      kind: "failed",
      message: "Cannot read blueprints. Check the connection and try again.",
    };
  }
}
export const fetchBlueprints = () => request("list", "");
export const fetchBlueprintSource = (path: string) =>
  request("source", `/source?path=${encodeURIComponent(path)}`);
export const lintBlueprintText = (path: string, text: string, signal: AbortSignal) =>
  request("lint", "/lint", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, text }),
    signal,
  });
export const saveBlueprint = (body: SaveBlueprintRequest) =>
  request("save", "/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
