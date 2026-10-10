// ---
// relationships:
//   implements: [declarations-api, decision-models]
// ---
import { findingRanges, lintDecisionModelSet } from "@wyrd-company/manifold-shared";
import type {
  ProcessRepositoryRevision,
  ProcessManifestFinding,
} from "@wyrd-company/manifold-shared";
import { isDecisionModelPath } from "@wyrd-company/manifold-shared/declarations-api";
import type { ModelText } from "@wyrd-company/manifold-shared/declarations-api";
import { record, onlyKeys } from "./request-checks.ts";
import { validPath as blueprintPath } from "../blueprints-api/request-checks.ts";
export function overlay(read: ProcessRepositoryRevision["read"], files: readonly ModelText[]) {
  const texts = new Map(files.map((file) => [file.path, file.text]));
  return (path: string) => (texts.has(path) ? Promise.resolve(texts.get(path)) : read(path));
}
export function textFiles(value: unknown, modelsOnly = true): value is ModelText[] {
  return (
    Array.isArray(value) &&
    value.every(
      (file) =>
        record(file) &&
        onlyKeys(file, ["path", "text"]) &&
        typeof file["text"] === "string" &&
        (isDecisionModelPath(file["path"]) || (!modelsOnly && blueprintPath(file["path"]))),
    ) &&
    new Set(value.map((file) => file.path)).size === value.length
  );
}
export async function modelFindings(
  read: ProcessRepositoryRevision["read"],
  path: string,
  text: string,
) {
  const result = await lintDecisionModelSet(read, path);
  return {
    result,
    ...locatedFindings(result.findings, new Map([[path, text]])),
  };
}
export function locatedFindings(
  findings: readonly ProcessManifestFinding[],
  texts: ReadonlyMap<string, string>,
) {
  const rows = findings.map((f) =>
    texts.has(f.file) ? findingRanges(texts.get(f.file)!, [f])[0]! : f,
  );
  return {
    findings: rows.filter((f) => f.severity === "error"),
    warnings: rows.filter((f) => f.severity === "warning"),
  };
}
