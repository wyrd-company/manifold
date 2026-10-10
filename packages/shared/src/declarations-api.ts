// ---
// relationships:
//   implements: [declarations-api, operator-console]
// ---
import {
  array,
  boolean,
  integer,
  natural,
  nonempty,
  oneOf,
  record,
  shape,
  string,
} from "./api-guards.ts";
import type { ApiFinding, FindingRange } from "./blueprints-api.ts";
export const declarationsApiPath = "/api/declarations";
export type DeclarationPath =
  | "bindings.yml"
  | "task-metadata.yml"
  | "portfolio.yml"
  | "accounts.yml";
export interface DeclarationFinding extends ApiFinding {
  readonly file?: "portfolio" | "bindings" | "accounts" | "prices";
}
export type TaskFieldType = "text" | "number" | "date" | "single-select";
export type StorageKindName =
  | "project-field"
  | "issue-field"
  | "issue-type"
  | "label"
  | "milestone"
  | "front-matter";
export interface TaskFieldScope {
  readonly kind: "project" | "organization" | "repository" | "issue";
  readonly names: readonly string[];
  readonly sharedWith?: readonly string[];
}
export interface TaskField {
  readonly scope?: TaskFieldScope;
  readonly binding: string;
  readonly name: string;
  readonly lifecycle: boolean;
  readonly location: string;
  readonly storage?: string;
  readonly type?: string;
  readonly settings?: Readonly<Record<string, string>>;
  readonly options?: readonly string[];
  readonly whenChanged?: string;
  readonly onGitHub?: {
    readonly state: "present" | "missing" | "differs";
    readonly detail: string;
  };
  readonly range?: FindingRange;
}
export interface StorageKind {
  readonly kind: StorageKindName;
  readonly types: readonly TaskFieldType[];
  readonly settings: readonly string[];
  readonly optionProperties?: readonly ("color" | "description")[];
  readonly color?: "named" | "hex";
  readonly scope?: TaskFieldScope["kind"];
}
export interface ProjectImpact {
  readonly binding: string;
  readonly creates?: number;
  readonly changes?: number;
  readonly removes?: number;
}
export interface SharingPreview {
  readonly account: string;
  readonly items: readonly {
    readonly item: string;
    readonly alone: number;
    readonly allWaiting: number;
  }[];
}
export interface AttachedCreatedProject {
  readonly environment: string;
  readonly project: string;
  readonly actorId: string;
  readonly item: string;
}
export type ArchiveProjectChoice = (
  | { readonly binding: string }
  | {
      readonly created: { readonly environment: string; readonly project: string };
      readonly name: string;
    }
) &
  (
    | { readonly choice: "move" }
    | { readonly choice: "archive" }
    | { readonly choice: "reassign"; readonly item: string }
  );
export interface ArchiveItemEdit {
  readonly item: string;
  readonly projects: readonly ArchiveProjectChoice[];
}
export interface ArchiveItemRequest extends SaveFields, ArchiveItemEdit {}
export interface DeclarationFindings {
  readonly preview?: readonly SharingPreview[];
  readonly findings: readonly DeclarationFinding[];
  readonly warnings: readonly DeclarationFinding[];
  readonly fields?: readonly TaskField[];
  readonly storageKinds?: readonly StorageKind[];
  readonly impact?: readonly ProjectImpact[];
}
export interface DeclarationSourceResponse extends DeclarationFindings {
  readonly environments?: readonly string[];
  readonly path: DeclarationPath;
  readonly commit: string;
  readonly exists: boolean;
  readonly text: string;
}
export type LintDeclarationResponse = DeclarationFindings;
export interface LintDeclarationRequest {
  readonly path: DeclarationPath;
  readonly text: string;
}
export type TaskFieldEdit =
  | { readonly kind: "add-field"; readonly binding: string }
  | { readonly kind: "remove-field"; readonly location: string }
  | {
      readonly kind: "set-field";
      readonly location: string;
      readonly values: {
        readonly name?: string;
        readonly type?: TaskFieldType;
        readonly storage?: StorageKindName;
        readonly settings?: Readonly<Record<string, string>>;
        readonly options?: readonly string[];
        readonly whenChanged?: "revert" | "accept";
      };
    };
export interface TaskFieldEditRequest {
  readonly text: string;
  readonly edit: TaskFieldEdit;
}
export interface TaskFieldEditResponse extends DeclarationFindings {
  readonly text: string;
  readonly location: string;
}
export interface SaveFields {
  readonly base: string;
  readonly message: string;
  readonly saveId: string;
}
export interface SaveDeclarationRequest extends SaveFields {
  readonly path: DeclarationPath;
  readonly text: string;
}
export interface SaveDeclarationResponse {
  readonly outcome: "saved" | "already-saved" | "unchanged";
  readonly commit: string;
  readonly loaded: boolean;
}
export interface SaveConflictResponse {
  readonly error: "conflict";
  readonly message: string;
  readonly reason: "file-changed" | "branch-moved";
  readonly head: string;
  readonly text?: string;
}
export interface SaveInvalidResponse {
  readonly error: "invalid";
  readonly message: string;
  readonly findings: readonly DeclarationFinding[];
  readonly warnings: readonly DeclarationFinding[];
}
export interface GitHubProjectEdit {
  readonly kind: "github-project";
  readonly mode: "add" | "replace";
  readonly name: string;
  readonly owner: string;
  readonly number: number;
  readonly environment: string;
  readonly item: string;
  readonly t3codeProjects: readonly string[];
}
export interface T3codeProjectEdit {
  readonly kind: "t3code-project";
  readonly mode: "add" | "replace";
  readonly name: string;
  readonly environment: string;
  readonly project: string;
  readonly item: string;
}
export type BindingEdit = GitHubProjectEdit | T3codeProjectEdit;
export interface BindingSaveRequest extends SaveFields {
  readonly edit: BindingEdit;
}
export interface GitHubProjectBinding {
  readonly name: string;
  readonly owner: string;
  readonly number: number;
  readonly environment: string;
  readonly item: string;
  readonly t3codeProjects: readonly string[];
  readonly archived: boolean;
}
export interface T3codeProjectBinding {
  readonly name: string;
  readonly environment: string;
  readonly project: string;
  readonly item: string;
  readonly archived: boolean;
}
export interface EnvironmentProject {
  readonly id: string;
  readonly title: string;
  readonly workspaceRoot: string;
  readonly activeThreads: number;
}
export interface BindingsResponse {
  readonly createdProjects: readonly AttachedCreatedProject[];
  readonly repository: { readonly url: string; readonly branch: string };
  readonly commit: string;
  readonly findings: readonly DeclarationFinding[];
  readonly githubProjects: readonly GitHubProjectBinding[];
  readonly t3codeProjects: readonly T3codeProjectBinding[];
  readonly items: readonly { readonly id: string; readonly title?: string }[];
  readonly environments: readonly {
    readonly name: string;
    readonly projects?: readonly EnvironmentProject[];
  }[];
}
const commit = (v: unknown) => string(v) && /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(v);
const name = (v: unknown) => string(v) && v.length <= 64 && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v);
const strings = array(string);
const range = (v: unknown) =>
  shape(v, {
    from: natural,
    to: natural,
    line: (n) => natural(n) && Number(n) >= 1,
    column: (n) => natural(n) && Number(n) >= 1,
  });
const finding = (v: unknown) =>
  record(v) &&
  string(v["kind"]) &&
  string(v["location"]) &&
  string(v["message"]) &&
  (!Object.hasOwn(v, "range") || range(v["range"])) &&
  (!Object.hasOwn(v, "file") || oneOf("portfolio", "bindings", "accounts", "prices")(v["file"]));
const findings = { findings: array(finding), warnings: array(finding) };
const fieldScope = (v: unknown) =>
  shape(
    v,
    { kind: oneOf("project", "organization", "repository", "issue"), names: strings },
    { sharedWith: strings },
  );
const field = (v: unknown) =>
  shape(
    v,
    { binding: string, name: string, lifecycle: boolean, location: string },
    {
      scope: fieldScope,
      storage: string,
      type: string,
      settings: (s) => record(s) && Object.values(s).every(string),
      options: strings,
      whenChanged: string,
      onGitHub: (s) => shape(s, { state: oneOf("present", "missing", "differs"), detail: string }),
      range,
    },
  );
const preview = array((v) =>
  shape(v, {
    account: name,
    items: array((v) =>
      shape(v, {
        item: nonempty,
        alone: (v) => typeof v === "number" && v >= 0 && v <= 100,
        allWaiting: (v) => typeof v === "number" && v >= 0 && v <= 100,
      }),
    ),
  }),
);
const metadata = {
  preview,
  fields: array(field),
  storageKinds: array((v) =>
    shape(
      v,
      {
        kind: oneOf(
          "project-field",
          "issue-field",
          "issue-type",
          "label",
          "milestone",
          "front-matter",
        ),
        types: array(oneOf("text", "number", "date", "single-select")),
        settings: strings,
      },
      {
        optionProperties: array(oneOf("color", "description")),
        color: oneOf("named", "hex"),
        scope: oneOf("project", "organization", "repository", "issue"),
      },
    ),
  ),
  impact: array(
    (v) =>
      shape(v, { binding: name }, { creates: natural, changes: natural, removes: natural }) &&
      record(v) &&
      (["creates", "changes", "removes"].every((k) => Object.hasOwn(v, k)) ||
        ["creates", "changes", "removes"].every((k) => !Object.hasOwn(v, k))),
  ),
};
export function isDeclarationSourceResponse(v: unknown): v is DeclarationSourceResponse {
  return shape(
    v,
    {
      ...findings,
      path: oneOf("bindings.yml", "task-metadata.yml", "portfolio.yml", "accounts.yml"),
      commit,
      exists: boolean,
      text: string,
    },
    { ...metadata, environments: array(name) },
  );
}
export function isLintDeclarationResponse(v: unknown): v is LintDeclarationResponse {
  return shape(v, findings, metadata);
}
export function isTaskFieldEditResponse(v: unknown): v is TaskFieldEditResponse {
  return shape(v, { ...findings, text: string, location: string }, metadata);
}
export function isSaveDeclarationResponse(v: unknown): v is SaveDeclarationResponse {
  return shape(v, {
    outcome: oneOf("saved", "already-saved", "unchanged"),
    commit,
    loaded: boolean,
  });
}
export function isSaveConflictResponse(v: unknown): v is SaveConflictResponse {
  return shape(
    v,
    {
      error: oneOf("conflict"),
      message: string,
      reason: oneOf("file-changed", "branch-moved"),
      head: commit,
    },
    { text: string },
  );
}
export function isSaveInvalidResponse(v: unknown): v is SaveInvalidResponse {
  return (
    shape(v, { error: oneOf("invalid"), message: string, ...findings }) &&
    record(v) &&
    Array.isArray(v["findings"]) &&
    v["findings"].length > 0
  );
}
export function isBindingsResponse(v: unknown): v is BindingsResponse {
  return shape(v, {
    repository: (r) => shape(r, { url: string, branch: string }),
    commit,
    findings: array(finding),
    createdProjects: array((p) =>
      shape(p, { environment: name, project: nonempty, actorId: nonempty, item: nonempty }),
    ),
    githubProjects: array((b) =>
      shape(b, {
        name,
        owner: string,
        number: (n) => integer(n) && Number(n) >= 1,
        environment: name,
        item: nonempty,
        t3codeProjects: array(nonempty),
        archived: boolean,
      }),
    ),
    t3codeProjects: array((b) =>
      shape(b, { name, environment: name, project: nonempty, item: nonempty, archived: boolean }),
    ),
    items: array((i) => shape(i, { id: nonempty }, { title: string })),
    environments: array((e) =>
      shape(
        e,
        { name },
        {
          projects: array((p) =>
            shape(p, {
              id: nonempty,
              title: string,
              workspaceRoot: string,
              activeThreads: natural,
            }),
          ),
        },
      ),
    ),
  });
}

export interface DeclarationErrorResponse {
  readonly error:
    | "bad-request"
    | "cross-site"
    | "not-found"
    | "method-not-allowed"
    | "too-large"
    | "unsupported-media-type"
    | "unavailable";
  readonly message: string;
}
export interface SaveRemoteErrorResponse {
  readonly error: "rejected" | "authentication" | "remote";
  readonly message: string;
}
export function isDeclarationErrorResponse(v: unknown): v is DeclarationErrorResponse {
  return (
    record(v) &&
    oneOf(
      "bad-request",
      "cross-site",
      "not-found",
      "method-not-allowed",
      "too-large",
      "unsupported-media-type",
      "unavailable",
    )(v["error"]) &&
    string(v["message"])
  );
}
export function isSaveRemoteErrorResponse(v: unknown): v is SaveRemoteErrorResponse {
  return shape(v, { error: oneOf("rejected", "authentication", "remote"), message: string });
}
