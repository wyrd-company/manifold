// ---
// relationships:
//   implements: [declarations-api, operator-console]
// ---
import { validateEvaluation, validateModel } from "./decision-model-validators.js";
import type { DecisionModelEvaluation } from "./decision-model-types.ts";
import type { ApiFinding } from "./blueprints-api.ts";
import { isLintResponse } from "./blueprints-api.ts";
import { array, boolean, record, shape, string } from "./api-guards.ts";
import type { SaveFields } from "./declarations-api.ts";
export interface ModelText {
  readonly path: string;
  readonly text: string;
}
export interface ModelFinding extends ApiFinding {
  readonly file: string;
}
export interface ModelFindings {
  readonly findings: readonly ModelFinding[];
  readonly warnings: readonly ModelFinding[];
}
export interface DecisionModelListResponse {
  readonly commit: string;
  readonly intake?: string;
  readonly models: readonly {
    readonly path: string;
    readonly exists: boolean;
    readonly intake: boolean;
  }[];
}
export interface DecisionModelSourceResponse extends ModelFindings {
  readonly path: string;
  readonly commit: string;
  readonly exists: boolean;
  readonly text: string;
}
export interface DecisionModelLintRequest extends ModelText {
  readonly base?: string;
  readonly models?: readonly ModelText[];
}
export interface DecisionModelEvaluateRequest extends DecisionModelLintRequest {
  readonly input: Record<string, unknown>;
}
export interface DecisionModelEvaluateResponse {
  readonly evaluation: DecisionModelEvaluation;
}
export interface PublishRequest extends SaveFields {
  readonly files: readonly ModelText[];
}
export interface PublishResponse {
  readonly outcome: "saved" | "already-saved" | "unchanged";
  readonly commit: string;
  readonly loaded: boolean;
}
export interface PublishConflictResponse {
  readonly error: "conflict";
  readonly message: string;
  readonly reason: "file-changed" | "branch-moved";
  readonly head: string;
  readonly files: readonly { readonly path: string; readonly text?: string }[];
}
export interface PublishInvalidResponse extends ModelFindings {
  readonly error: "invalid";
  readonly message: string;
}
export const isRepositoryCommit = (value: unknown): value is string =>
  typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
export function isDecisionModelPath(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.endsWith(".yml") &&
    !value.startsWith("blueprints/") &&
    ![
      "bindings.yml",
      "task-metadata.yml",
      "portfolio.yml",
      "accounts.yml",
      "prices.yml",
      "manifold.yml",
    ].includes(value) &&
    !/[\\\0]/.test(value) &&
    value.split("/").every((p) => p !== "" && p !== "." && p !== "..")
  );
}
const finding = (value: unknown) =>
  record(value) && string(value["file"]) && isLintResponse({ findings: [value], warnings: [] });
export const isModelFindings = (value: unknown): value is ModelFindings =>
  shape(value, { findings: array(finding), warnings: array(finding) });
export const isDecisionModelListResponse = (value: unknown): value is DecisionModelListResponse =>
  shape(
    value,
    {
      commit: isRepositoryCommit,
      models: array((v) =>
        shape(v, { path: isDecisionModelPath, exists: boolean, intake: boolean }),
      ),
    },
    { intake: isDecisionModelPath },
  );
export const isDecisionModelSourceResponse = (
  value: unknown,
): value is DecisionModelSourceResponse =>
  shape(value, {
    path: isDecisionModelPath,
    commit: isRepositoryCommit,
    exists: boolean,
    text: string,
    findings: array(finding),
    warnings: array(finding),
  });
export function isDecisionModelEvaluateResponse(
  value: unknown,
): value is DecisionModelEvaluateResponse {
  return shape(value, { evaluation: validateEvaluation });
}
export function isDrawableDecisionModel(value: unknown): boolean {
  if (!record(value) || !Array.isArray(value["nodes"])) return false;
  const checked = {
    ...value,
    nodes: value["nodes"].map((node) => {
      if (!record(node)) return node;
      const content = node["content"];
      const unsupported =
        typeof node["type"] === "string" &&
        (!["inputNode", "outputNode", "decisionNode", "customNode"].includes(node["type"]) ||
          (node["type"] === "customNode" &&
            record(content) &&
            typeof content["kind"] === "string" &&
            !["jsonataDecisionTable", "jsonataExpression", "jsonataSwitch"].includes(
              content["kind"],
            )));
      return unsupported ? { ...node, type: "inputNode", content: {} } : node;
    }),
  };
  return validateModel(checked);
}
export const isPublishResponse = (value: unknown): value is PublishResponse =>
  shape(value, {
    outcome: (v) => ["saved", "already-saved", "unchanged"].includes(String(v)),
    commit: isRepositoryCommit,
    loaded: boolean,
  });
export const isPublishConflictResponse = (value: unknown): value is PublishConflictResponse =>
  shape(value, {
    error: (v) => v === "conflict",
    message: string,
    reason: (v) => v === "file-changed" || v === "branch-moved",
    head: isRepositoryCommit,
    files: array((v) => shape(v, { path: string }, { text: string })),
  });
export const isPublishInvalidResponse = (value: unknown): value is PublishInvalidResponse =>
  shape(value, {
    error: (v) => v === "invalid",
    message: string,
    findings: array(finding),
    warnings: array(finding),
  });
