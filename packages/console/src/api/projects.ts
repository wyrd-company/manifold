// ---
// relationships:
//   implements: [projects-api, operator-console]
// ---
export type ProjectConfigurationState =
  | { readonly state: "in-sync" | "not-applied" }
  | { readonly state: "drift" | "pending"; readonly count: number };
export interface ProjectSummary {
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly projectNodeId: string | null;
  readonly portfolioItem: string;
  readonly environment: string;
  readonly configuration: ProjectConfigurationState;
  readonly lastApplied: { readonly at: number; readonly commit: string } | null;
  readonly observedAt: number | null;
}
export interface ProjectsResponse {
  readonly projects: readonly ProjectSummary[];
}
export interface ProjectOption {
  readonly name: string;
  readonly color: "gray" | "blue" | "green" | "yellow" | "orange" | "red" | "pink" | "purple";
  readonly description: string;
}
export interface ProjectField {
  readonly name: string;
  readonly type: "text" | "number" | "date" | "single-select" | "multi-select" | "iteration";
  readonly options?: readonly ProjectOption[];
}
export interface ProjectChange {
  readonly id: string;
  readonly storage: "project-field";
  readonly target: {
    readonly field: string;
    readonly lifecycle: boolean;
    readonly option?: string;
    readonly taskField?: string;
  };
  readonly description: string;
  readonly action: "create" | "change" | "remove";
  readonly side: "github" | "declaration";
  readonly drift: boolean;
  readonly requiresRemoval: boolean;
  readonly properties: readonly ("name" | "options" | "order" | "color" | "description")[];
  readonly from: ProjectField | ProjectOption | null;
  readonly to: ProjectField | ProjectOption | null;
}
export interface ProjectFieldStatus {
  readonly field: string;
  readonly lifecycle: boolean;
  readonly github: "present" | "missing" | "differs";
  readonly detail: string;
  readonly taskField?: string;
}
export interface ProjectPlanResponse {
  readonly binding: string;
  readonly owner: string;
  readonly number: number;
  readonly projectNodeId: string;
  readonly declarationCommit: string | null;
  readonly observedAt: number | null;
  readonly observation:
    | { readonly status: "fresh" }
    | { readonly status: "stale"; readonly message: string };
  readonly configuration: ProjectConfigurationState;
  readonly changes: readonly ProjectChange[];
  readonly digest: string;
  readonly fields: readonly ProjectFieldStatus[];
  readonly frontMatter: { readonly mismatched: number } | null;
}
export interface AppliedProjectChange extends ProjectChange {
  readonly outcome: "applied" | "kept" | "failed" | "not-run";
}
export interface ProjectApplyResponse {
  readonly outcome: "applied" | "in-sync";
  readonly changes: readonly AppliedProjectChange[];
  readonly writes: number;
  readonly configuration: ProjectConfigurationState;
  readonly declarationCommit: string | null;
}
export type ProjectResult<T> =
  | { kind: "ok"; body: T }
  | { kind: "missing" | "unresolved" | "stale" | "invalid"; message: string }
  | { kind: "pending"; message: string; commit?: string }
  | {
      kind: "failed";
      message: string;
      errorKind?: string;
      writes?: number;
      changes?: readonly AppliedProjectChange[];
    };
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const string = (v: unknown) => typeof v === "string";
const boolean = (v: unknown) => typeof v === "boolean";
const integer = (v: unknown) => typeof v === "number" && Number.isInteger(v);
const natural = (v: unknown) => integer(v) && Number(v) >= 0;
const positive = (v: unknown) => integer(v) && Number(v) >= 1;
const oneOf =
  (...values: readonly unknown[]) =>
  (v: unknown) =>
    values.includes(v);
const array = (guard: (v: unknown) => boolean) => (v: unknown) =>
  Array.isArray(v) && v.every(guard);
const nullable = (guard: (v: unknown) => boolean) => (v: unknown) => v === null || guard(v);
function shape(
  v: unknown,
  required: Record<string, (v: unknown) => boolean>,
  optional: Record<string, (v: unknown) => boolean> = {},
): boolean {
  return (
    record(v) &&
    Object.entries(required).every(([key, guard]) => Object.hasOwn(v, key) && guard(v[key])) &&
    Object.keys(v).every(
      (key) =>
        Object.hasOwn(required, key) || (Object.hasOwn(optional, key) && optional[key]!(v[key])),
    )
  );
}
const configuration = (v: unknown) =>
  shape(v, { state: oneOf("in-sync", "not-applied") }) ||
  shape(v, { state: oneOf("drift", "pending"), count: positive });
const summary = (v: unknown) =>
  shape(v, {
    binding: string,
    owner: string,
    number: positive,
    projectNodeId: nullable(string),
    portfolioItem: string,
    environment: string,
    configuration,
    lastApplied: nullable((a) => shape(a, { at: integer, commit: string })),
    observedAt: nullable(integer),
  });
const option = (v: unknown) =>
  shape(v, {
    name: string,
    color: oneOf("gray", "blue", "green", "yellow", "orange", "red", "pink", "purple"),
    description: string,
  });
const field = (v: unknown) =>
  shape(
    v,
    {
      name: string,
      type: oneOf("text", "number", "date", "single-select", "multi-select", "iteration"),
    },
    { options: array(option) },
  );
const target = nullable((v) => field(v) || option(v));
const changeMembers = {
  id: string,
  storage: oneOf("project-field"),
  target: (v: unknown) =>
    shape(v, { field: string, lifecycle: boolean }, { option: string, taskField: string }),
  description: string,
  action: oneOf("create", "change", "remove"),
  side: oneOf("github", "declaration"),
  drift: boolean,
  requiresRemoval: boolean,
  properties: (v: unknown) =>
    array(oneOf("name", "options", "order", "color", "description"))(v) &&
    Array.isArray(v) &&
    new Set(v).size === v.length,
  from: target,
  to: target,
};
const change = (v: unknown) => shape(v, changeMembers);
const appliedChange = (v: unknown) =>
  shape(v, { ...changeMembers, outcome: oneOf("applied", "kept", "failed", "not-run") });
export function isProjectsResponse(v: unknown): v is ProjectsResponse {
  return shape(v, { projects: array(summary) });
}
export function isProjectPlanResponse(v: unknown): v is ProjectPlanResponse {
  return shape(v, {
    binding: string,
    owner: string,
    number: positive,
    projectNodeId: string,
    declarationCommit: nullable(string),
    observedAt: nullable(integer),
    observation: (o) =>
      shape(o, { status: oneOf("fresh") }) || shape(o, { status: oneOf("stale"), message: string }),
    configuration,
    changes: array(change),
    digest: (d) => string(d) && /^[0-9a-f]{64}$/.test(String(d)),
    fields: array((f) =>
      shape(
        f,
        {
          field: string,
          lifecycle: boolean,
          github: oneOf("present", "missing", "differs"),
          detail: string,
        },
        { taskField: string },
      ),
    ),
    frontMatter: nullable((f) => shape(f, { mismatched: natural })),
  });
}
export function isProjectApplyResponse(v: unknown): v is ProjectApplyResponse {
  return shape(v, {
    outcome: oneOf("applied", "in-sync"),
    changes: array(appliedChange),
    writes: natural,
    configuration,
    declarationCommit: nullable(string),
  });
}
const errorKinds = oneOf(
  "unknown-binding",
  "unresolved-project",
  "undeclared",
  "declaration-conflict",
  "declaration-invalid",
  "declaration-pending",
  "invalid-request",
  "plan-stale",
  "unobserved",
  "unavailable",
  "method-not-allowed",
  "not-found",
);
const writeErrorKinds = oneOf(
  "field-missing",
  "option-missing",
  "forbidden",
  "transport",
  "rejected",
  "declaration-unsaved",
);
interface ProjectError {
  readonly error: { readonly kind: string; readonly message: string; readonly commit?: string };
}
interface ProjectApplyFailure {
  readonly error: { readonly kind: string; readonly message: string };
  readonly writes: number;
  readonly changes: readonly AppliedProjectChange[];
}
const isError = (v: unknown): v is ProjectError =>
  shape(v, { error: (e) => shape(e, { kind: errorKinds, message: string }, { commit: string }) });
const isApplyFailure = (v: unknown): v is ProjectApplyFailure =>
  shape(v, {
    error: (e) => shape(e, { kind: writeErrorKinds, message: string }),
    writes: natural,
    changes: array(appliedChange),
  });
type Bodies = { list: ProjectsResponse; plan: ProjectPlanResponse; apply: ProjectApplyResponse };
const guards = {
  list: isProjectsResponse,
  plan: isProjectPlanResponse,
  apply: isProjectApplyResponse,
};
const fallback = "Cannot read Projects. Check the connection and try again.";
export function mapProjectResult<K extends keyof Bodies>(
  operation: K,
  status: number,
  body: unknown,
): ProjectResult<Bodies[K]> {
  if (status === 200 && guards[operation](body)) return { kind: "ok", body: body as Bodies[K] };
  if (operation === "apply" && status === 502 && isApplyFailure(body))
    return {
      kind: "failed",
      errorKind: body.error.kind,
      message: body.error.message,
      writes: body.writes,
      changes: body.changes,
    };
  if (status !== 200 && isError(body)) {
    const { kind, message, commit } = body.error;
    if (status === 404 && kind === "unknown-binding") return { kind: "missing", message };
    if (status === 409 && kind === "unresolved-project") return { kind: "unresolved", message };
    if (operation === "apply" && status === 409) {
      if (kind === "plan-stale") return { kind: "stale", message };
      if (kind === "declaration-invalid") return { kind: "invalid", message };
      if (kind === "declaration-pending")
        return { kind: "pending", message, ...(commit === undefined ? {} : { commit }) };
    }
    return { kind: "failed", errorKind: kind, message };
  }
  return { kind: "failed", message: fallback };
}
async function request<K extends keyof Bodies>(
  operation: K,
  path: string,
  init?: RequestInit,
): Promise<ProjectResult<Bodies[K]>> {
  try {
    const response = await fetch("/api/projects" + path, init);
    return mapProjectResult(operation, response.status, await response.json());
  } catch {
    return { kind: "failed", message: fallback };
  }
}
export const fetchProjects = () => request("list", "");
export const fetchProjectPlan = (binding: string) =>
  request("plan", `/${encodeURIComponent(binding)}/plan`);
export const applyProject = (binding: string, removeUndeclared: boolean, digest: string) =>
  request("apply", `/${encodeURIComponent(binding)}/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ removeUndeclared, digest }),
  });
