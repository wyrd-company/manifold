// ---
// relationships:
//   implements: [blueprint, decision-models]
// ---
import { parse } from "yaml";
import { lintDecisionModelSet } from "./process-manifest.ts";
import type { DecisionModelSetLint, ProcessManifestFinding } from "./process-manifest.ts";
export function invokedDecisionModelPaths(text: string): string[] {
  const paths = new Set<string>();
  function walk(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const node = value as Record<string, unknown>;
    const invokes = Array.isArray(node["invoke"]) ? node["invoke"] : [node["invoke"]];
    for (const invoke of invokes) {
      if (!invoke || typeof invoke !== "object") continue;
      const src: unknown = Reflect.get(invoke, "src");
      if (typeof src === "string" && /^decision-models\/.+\.yml$/.test(src)) paths.add(src);
    }
    if (node["states"] && typeof node["states"] === "object")
      for (const child of Object.values(node["states"])) walk(child);
  }
  try {
    walk(parse(text)?.machine);
  } catch {
    /* Blueprint lint reports malformed source. */
  }
  return [...paths].sort();
}
export async function lintInvokedDecisionModels(
  read: (path: string) => Promise<string | undefined>,
  text: string,
  lint: (path: string) => Promise<DecisionModelSetLint> = (path) =>
    lintDecisionModelSet(read, path),
): Promise<ReadonlyMap<string, readonly ProcessManifestFinding[]>> {
  const models = new Map<string, readonly ProcessManifestFinding[]>();
  for (const path of invokedDecisionModelPaths(text)) {
    const result = await lint(path);
    if (
      result.findings.some(
        (f) => f.file === path && f.location === "" && f.kind === "model-missing",
      )
    )
      continue;
    models.set(
      path,
      result.findings.filter((f) => f.severity === "error"),
    );
  }
  return models;
}
