// ---
// relationships:
//   implements: [blueprints-api, operator-console]
// ---
import { blueprintGraph, findingRanges } from "@wyrd-company/manifold-shared";
import type { BlueprintLint } from "@wyrd-company/manifold-shared";
import type {
  BlueprintItem,
  BlueprintsResponse,
  LintResponse,
} from "@wyrd-company/manifold-shared/blueprints-api";
import {
  ProcessRepositorySaveError,
  ProcessRepositoryPullError,
} from "../process-repository/index.ts";
import type { SavedRevision } from "../service/index.ts";

export function lintAnswer(text: string, lint: BlueprintLint): LintResponse {
  const graph = blueprintGraph(text);
  return {
    findings: findingRanges(text, lint.ok ? [] : lint.findings),
    warnings: findingRanges(text, lint.warnings),
    ...(graph ? { graph } : {}),
  };
}
export function listAnswer(
  repository: BlueprintsResponse["repository"],
  commit: string | undefined,
  blueprints: BlueprintItem[],
): BlueprintsResponse {
  return { repository, ...(commit ? { commit } : {}), blueprints };
}
export function invalidAnswer(lint: LintResponse) {
  return {
    error: "invalid",
    message: "Blueprint has findings.",
    findings: lint.findings,
    warnings: lint.warnings,
  };
}
export function saveAnswer(result: SavedRevision, blueprint?: BlueprintItem) {
  if (result.outcome === "conflict")
    return {
      status: 409,
      body: {
        error: "conflict",
        message: "The process repository branch changed.",
        reason: result.reason,
        head: result.head,
        ...(result.files.length === 1 && result.files[0]!.text !== undefined
          ? { text: result.files[0]!.text }
          : {}),
      },
    };
  return {
    status: 200,
    body: { outcome: result.outcome, commit: result.commit, ...(blueprint ? { blueprint } : {}) },
  };
}
export function failureAnswer(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof ProcessRepositorySaveError || error instanceof ProcessRepositoryPullError)
    return {
      status: 502,
      body: {
        error:
          error.kind === "authentication"
            ? "authentication"
            : error.kind === "rejected"
              ? "rejected"
              : "remote",
        message,
      },
    };
  if (error instanceof TypeError && message === "Revision follower is closed")
    return { status: 503, body: { error: "unavailable", message } };
  return { status: 500, body: { error: "internal", message: "Blueprint request failed." } };
}
