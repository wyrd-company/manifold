// ---
// relationships:
//   implements: [blueprints-api, operator-console]
// ---
export const blueprintsApiPath = "/api/blueprints";

export interface FindingRange {
  readonly from: number;
  readonly to: number;
  readonly line: number;
  readonly column: number;
}

export interface ApiFinding {
  readonly kind: string;
  readonly location: string;
  readonly message: string;
  readonly range?: FindingRange;
  readonly [detail: string]: unknown;
}

export interface BlueprintGraph {
  readonly states: readonly GraphState[];
  readonly transitions: readonly GraphTransition[];
}

export interface GraphState {
  readonly path: string;
  readonly key: string;
  readonly parent?: string;
  readonly type: "atomic" | "compound" | "parallel" | "final" | "history";
  readonly initial: boolean;
  readonly invokes: readonly string[];
  readonly gated: boolean;
  readonly location: string;
  readonly range?: FindingRange;
}

export interface GraphTransition {
  readonly source: string;
  readonly target?: string;
  readonly trigger: "event" | "always" | "after" | "done" | "error";
  readonly label: string;
  readonly guarded: boolean;
  readonly location: string;
}

export interface BlueprintItem {
  readonly path: string;
  readonly source: "repository" | "bundled";
  readonly commit?: string;
  readonly bundle?: string;
  readonly replacesBundled?: true;
  readonly status: "loaded" | "invalid";
  readonly findings: number;
  readonly warnings: number;
  readonly description?: string;
  readonly activeActors: number;
}

export interface BlueprintsResponse {
  readonly repository: { readonly url: string; readonly branch: string };
  readonly commit?: string;
  readonly blueprints: readonly BlueprintItem[];
}

export interface BlueprintSourceResponse {
  readonly path: string;
  readonly source: "repository" | "bundled";
  readonly commit?: string;
  readonly bundle?: string;
  readonly text: string;
  readonly findings: readonly ApiFinding[];
  readonly warnings: readonly ApiFinding[];
  readonly graph?: BlueprintGraph;
}

export interface LintResponse {
  readonly findings: readonly ApiFinding[];
  readonly warnings: readonly ApiFinding[];
  readonly graph?: BlueprintGraph;
}

export interface SaveBlueprintRequest {
  readonly path: string;
  readonly base: string;
  readonly text: string;
  readonly message: string;
  readonly saveId: string;
}

export interface SaveBlueprintResponse {
  readonly outcome: "saved" | "already-saved" | "unchanged";
  readonly commit: string;
  readonly blueprint?: BlueprintItem;
}

export interface SaveConflictResponse {
  readonly error: "conflict";
  readonly message: string;
  readonly reason: "file-changed" | "branch-moved";
  readonly head: string;
  readonly text?: string;
}

export interface LintBlueprintRequest {
  readonly base?: string;
  readonly models?: readonly { readonly path: string; readonly text: string }[];
  readonly path: string;
  readonly text: string;
}
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const nonempty = (value: unknown): value is string => string(value) && value.length > 0;
const count = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const commit = (value: unknown): value is string =>
  string(value) && /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(value);
const path = (value: unknown): value is string =>
  string(value) &&
  /^blueprints\/.+\.ya?ml$/.test(value) &&
  !value.includes("\\") &&
  value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
const keys = (value: Record<string, unknown>, allowed: readonly string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const optional = (value: Record<string, unknown>, key: string, check: (v: unknown) => boolean) =>
  !(key in value) || check(value[key]);
const source = (value: unknown) => value === "repository" || value === "bundled";
function range(value: unknown): boolean {
  return (
    record(value) &&
    keys(value, ["from", "to", "line", "column"]) &&
    count(value["from"]) &&
    count(value["to"]) &&
    value["from"] <= value["to"] &&
    count(value["line"]) &&
    value["line"] > 0 &&
    count(value["column"]) &&
    value["column"] > 0
  );
}
function finding(value: unknown): boolean {
  return (
    record(value) &&
    string(value["kind"]) &&
    string(value["location"]) &&
    string(value["message"]) &&
    optional(value, "range", range) &&
    ["line", "column"].every((key) => optional(value, key, (v) => count(v) && v > 0))
  );
}
const arrayOf = (value: unknown, check: (v: unknown) => boolean): boolean =>
  Array.isArray(value) && value.every(check);
function graph(value: unknown): boolean {
  return (
    record(value) &&
    keys(value, ["states", "transitions"]) &&
    arrayOf(
      value["states"],
      (state) =>
        record(state) &&
        keys(state, [
          "path",
          "key",
          "parent",
          "type",
          "initial",
          "invokes",
          "gated",
          "location",
          "range",
        ]) &&
        nonempty(state["path"]) &&
        nonempty(state["key"]) &&
        optional(state, "parent", nonempty) &&
        ["atomic", "compound", "parallel", "final", "history"].includes(
          typeof state["type"] === "string" ? state["type"] : "",
        ) &&
        typeof state["initial"] === "boolean" &&
        arrayOf(state["invokes"], string) &&
        typeof state["gated"] === "boolean" &&
        string(state["location"]) &&
        optional(state, "range", range),
    ) &&
    arrayOf(
      value["transitions"],
      (row) =>
        record(row) &&
        keys(row, ["source", "target", "trigger", "label", "guarded", "location"]) &&
        nonempty(row["source"]) &&
        optional(row, "target", nonempty) &&
        ["event", "always", "after", "done", "error"].includes(
          typeof row["trigger"] === "string" ? row["trigger"] : "",
        ) &&
        string(row["label"]) &&
        typeof row["guarded"] === "boolean" &&
        string(row["location"]),
    )
  );
}
function item(value: unknown): boolean {
  return (
    record(value) &&
    keys(value, [
      "path",
      "source",
      "commit",
      "bundle",
      "replacesBundled",
      "status",
      "findings",
      "warnings",
      "description",
      "activeActors",
    ]) &&
    path(value["path"]) &&
    source(value["source"]) &&
    optional(value, "commit", commit) &&
    optional(value, "bundle", nonempty) &&
    optional(value, "replacesBundled", (v) => v === true) &&
    (value["status"] === "loaded" || value["status"] === "invalid") &&
    count(value["findings"]) &&
    count(value["warnings"]) &&
    count(value["activeActors"]) &&
    optional(value, "description", string)
  );
}
export function isBlueprintsResponse(value: unknown): value is BlueprintsResponse {
  return (
    record(value) &&
    keys(value, ["repository", "commit", "blueprints"]) &&
    record(value["repository"]) &&
    keys(value["repository"], ["url", "branch"]) &&
    string(value["repository"]["url"]) &&
    string(value["repository"]["branch"]) &&
    optional(value, "commit", commit) &&
    arrayOf(value["blueprints"], item)
  );
}
export function isBlueprintSourceResponse(value: unknown): value is BlueprintSourceResponse {
  return (
    record(value) &&
    keys(value, ["path", "source", "commit", "bundle", "text", "findings", "warnings", "graph"]) &&
    path(value["path"]) &&
    source(value["source"]) &&
    optional(value, "commit", commit) &&
    optional(value, "bundle", nonempty) &&
    string(value["text"]) &&
    arrayOf(value["findings"], finding) &&
    arrayOf(value["warnings"], finding) &&
    optional(value, "graph", graph)
  );
}
export function isLintResponse(value: unknown): value is LintResponse {
  return (
    record(value) &&
    keys(value, ["findings", "warnings", "graph"]) &&
    arrayOf(value["findings"], finding) &&
    arrayOf(value["warnings"], finding) &&
    optional(value, "graph", graph)
  );
}
export function isSaveBlueprintResponse(value: unknown): value is SaveBlueprintResponse {
  return (
    record(value) &&
    keys(value, ["outcome", "commit", "blueprint"]) &&
    ["saved", "already-saved", "unchanged"].includes(
      typeof value["outcome"] === "string" ? value["outcome"] : "",
    ) &&
    commit(value["commit"]) &&
    optional(value, "blueprint", item)
  );
}
export function isSaveConflictResponse(value: unknown): value is SaveConflictResponse {
  return (
    record(value) &&
    keys(value, ["error", "message", "reason", "head", "text"]) &&
    value["error"] === "conflict" &&
    string(value["message"]) &&
    (value["reason"] === "file-changed" || value["reason"] === "branch-moved") &&
    commit(value["head"]) &&
    optional(value, "text", string)
  );
}
