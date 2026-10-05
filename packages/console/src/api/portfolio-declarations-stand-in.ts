// ---
// relationships:
//   implements: portfolio-api
// ---
// Structural DeclarationEditorApi client until 1174 merges.
import type { PortfolioFinding } from "@wyrd-company/manifold-shared";
import type { PortfolioWarning } from "@wyrd-company/manifold-shared/portfolio-api";
export interface DeclarationLint {
  findings: readonly PortfolioFinding[];
  warnings: readonly PortfolioWarning[];
}
export interface DeclarationSource extends DeclarationLint {
  path: string;
  commit: string;
  exists: boolean;
  text: string;
}
export interface DeclarationSave {
  outcome: "saved" | "already-saved" | "unchanged";
  commit: string;
  loaded: boolean;
}
export interface DeclarationConflict {
  reason: "file-changed" | "branch-moved";
  head: string;
  text?: string;
}
export type DeclarationResult<T> =
  | { kind: "ok"; body: T }
  | { kind: "invalid"; body: DeclarationLint }
  | { kind: "conflict"; body: DeclarationConflict }
  | { kind: "failed"; message: string };
function findings(value: unknown): value is DeclarationLint {
  return (
    typeof value === "object" &&
    value !== null &&
    "findings" in value &&
    Array.isArray(value.findings) &&
    "warnings" in value &&
    Array.isArray(value.warnings) &&
    [...value.findings, ...value.warnings].every(
      (f) =>
        typeof f === "object" &&
        f !== null &&
        typeof f.file === "string" &&
        typeof f.kind === "string" &&
        typeof f.location === "string" &&
        typeof f.message === "string",
    )
  );
}
async function request<T>(
  operation: "source" | "lint" | "save",
  body?: unknown,
  signal?: AbortSignal,
): Promise<DeclarationResult<T>> {
  try {
    const response = await fetch(
      "/api/declarations/" + operation + (operation === "source" ? "?path=portfolio.yml" : ""),
      {
        ...(body === undefined
          ? {}
          : {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            }),
        ...(signal ? { signal } : {}),
      },
    );
    const v: unknown = await response.json();
    if (typeof v === "object" && v !== null) {
      if (
        response.status === 409 &&
        "reason" in v &&
        ["file-changed", "branch-moved"].includes(String(v.reason)) &&
        "head" in v &&
        typeof v.head === "string" &&
        (!Object.hasOwn(v, "text") || ("text" in v && typeof v.text === "string"))
      )
        return { kind: "conflict", body: v as DeclarationConflict };
      if (response.status === 422 && findings(v)) return { kind: "invalid", body: v };
      const valid =
        operation === "lint"
          ? findings(v)
          : operation === "source"
            ? findings(v) &&
              "path" in v &&
              v.path === "portfolio.yml" &&
              "commit" in v &&
              typeof v.commit === "string" &&
              "text" in v &&
              typeof v.text === "string" &&
              "exists" in v &&
              typeof v.exists === "boolean"
            : "commit" in v &&
              typeof v.commit === "string" &&
              "outcome" in v &&
              ["saved", "already-saved", "unchanged"].includes(String(v.outcome)) &&
              "loaded" in v &&
              typeof v.loaded === "boolean";
      if (response.status === 200 && valid) return { kind: "ok", body: v as T };
      if ("message" in v && typeof v.message === "string")
        return { kind: "failed", message: v.message };
    }
    return { kind: "failed", message: "Cannot read declarations. Try again." };
  } catch {
    return { kind: "failed", message: "Cannot read declarations. Try again." };
  }
}
export const fetchDeclarationSource = () => request<DeclarationSource>("source");
export const lintDeclarationText = (path: string, text: string, signal: AbortSignal) =>
  request<DeclarationLint>("lint", { path, text }, signal);
export const saveDeclaration = (body: {
  path: string;
  base: string;
  text: string;
  message: string;
  saveId: string;
}) => request<DeclarationSave>("save", body);
