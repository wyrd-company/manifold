// ---
// relationships:
//   implements: [declarations-api, operator-console]
// ---
import {
  declarationsApiPath,
  isBindingsResponse,
  isDeclarationSourceResponse,
  isLintDeclarationResponse,
  isTaskFieldEditResponse,
  isSaveDeclarationResponse,
  isSaveConflictResponse,
  isSaveInvalidResponse,
  isDeclarationErrorResponse,
  isSaveRemoteErrorResponse,
} from "@wyrd-company/manifold-shared/declarations-api";
import type {
  BindingSaveRequest,
  BindingsResponse,
  DeclarationPath,
  DeclarationSourceResponse,
  LintDeclarationResponse,
  TaskFieldEditRequest,
  TaskFieldEditResponse,
  SaveDeclarationRequest,
  SaveDeclarationResponse,
  SaveConflictResponse,
  SaveInvalidResponse,
} from "@wyrd-company/manifold-shared/declarations-api";
export type DeclarationResult<T> =
  | { kind: "ok"; body: T }
  | { kind: "conflict"; body: SaveConflictResponse }
  | { kind: "invalid"; body: SaveInvalidResponse; message: string }
  | { kind: "failed"; message: string };
type Bodies = {
  source: DeclarationSourceResponse;
  lint: LintDeclarationResponse;
  edit: TaskFieldEditResponse;
  save: SaveDeclarationResponse;
  bindings: BindingsResponse;
};
const guards = {
  source: isDeclarationSourceResponse,
  lint: isLintDeclarationResponse,
  edit: isTaskFieldEditResponse,
  save: isSaveDeclarationResponse,
  bindings: isBindingsResponse,
};
const fallback = "Cannot read declarations. Check the connection and try again.";
export function mapDeclarationResult<K extends keyof Bodies>(
  operation: K,
  status: number,
  body: unknown,
): DeclarationResult<Bodies[K]> {
  if (status === 200 && guards[operation](body)) return { kind: "ok", body: body as Bodies[K] };
  if (status === 409 && isSaveConflictResponse(body)) return { kind: "conflict", body };
  if (status === 422 && isSaveInvalidResponse(body))
    return { kind: "invalid", body, message: body.message };
  return {
    kind: "failed",
    message:
      status !== 200 && (isDeclarationErrorResponse(body) || isSaveRemoteErrorResponse(body))
        ? body.message
        : fallback,
  };
}
async function request<K extends keyof Bodies>(
  operation: K,
  path: string,
  init?: RequestInit,
): Promise<DeclarationResult<Bodies[K]>> {
  try {
    const response = await fetch(declarationsApiPath + path, init);
    return mapDeclarationResult(operation, response.status, await response.json());
  } catch {
    return { kind: "failed", message: fallback };
  }
}
const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  ...(signal ? { signal } : {}),
});
export const fetchDeclarationSource = (path: DeclarationPath) =>
  request("source", `/source?path=${encodeURIComponent(path)}`);
export const lintDeclarationText = (path: DeclarationPath, text: string, signal: AbortSignal) =>
  request("lint", "/lint", post({ path, text }, signal));
export const saveDeclaration = (body: SaveDeclarationRequest) =>
  request("save", "/save", post(body));
export const editTaskFields = (body: TaskFieldEditRequest) =>
  request("edit", "/task-fields/edit", post(body));
export const fetchBindings = () => request("bindings", "/bindings");
export const saveBinding = (body: BindingSaveRequest) =>
  request("save", "/bindings/save", post(body));
