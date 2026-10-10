// ---
// relationships:
//   implements: operator-console
// ---
import { isDecisionModelPath } from "@wyrd-company/manifold-shared/declarations-api";
import type { BlueprintDraft } from "../draft.ts";
export interface ModelDraft {
  readonly baseText: string;
  readonly text: string;
  readonly exists: boolean;
}
export function applyModelDraft(
  draft: BlueprintDraft,
  path: string,
  model: ModelDraft,
): BlueprintDraft {
  const models = { ...draft.models };
  if (model.text === model.baseText) delete models[path];
  else models[path] = model;
  return {
    base: draft.base,
    baseText: draft.baseText,
    text: draft.text,
    models,
  };
}
export function changedFiles(path: string, draft: BlueprintDraft, added: boolean) {
  return [
    ...(draft.text !== draft.baseText ? [{ path, text: draft.text, added }] : []),
    ...Object.entries(draft.models ?? {})
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([path, model]) => ({
        path,
        text: model.text,
        added: !model.exists,
      })),
  ];
}
export function settleModelDraft(
  draft: BlueprintDraft,
  source: { commit?: string; text: string },
  models: Readonly<Record<string, { text: string; exists: boolean }>>,
  loaded: boolean,
): BlueprintDraft | undefined {
  if (!draft.saved || !loaded || !source.commit) return draft;
  if (Object.keys(draft.models ?? {}).some((path) => !models[path])) return draft;
  if (
    source.text === draft.text &&
    Object.entries(draft.models ?? {}).every(([path, model]) => models[path]!.text === model.text)
  )
    return;
  const next: Record<string, ModelDraft> = {};
  for (const [path, model] of Object.entries(draft.models ?? {}))
    if (models[path]!.text !== model.text)
      next[path] = {
        baseText: models[path]!.text,
        text: model.text,
        exists: models[path]!.exists,
      };
  return {
    base: source.commit,
    baseText: source.text,
    text: draft.text,
    models: next,
  };
}
export function validModelDrafts(value: unknown): value is Record<string, ModelDraft> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every(isDecisionModelPath) &&
    Object.values(value).every(
      (model) =>
        typeof model === "object" &&
        model !== null &&
        "baseText" in model &&
        typeof model.baseText === "string" &&
        "text" in model &&
        typeof model.text === "string" &&
        "exists" in model &&
        typeof model.exists === "boolean",
    )
  );
}
