// ---
// relationships:
//   implements: operator-console
// ---
import { readDraft, writeDraft } from "../blueprints/draft.ts";
import type { BlueprintDraft } from "../blueprints/draft.ts";
import { applyEdits } from "./edits.ts";
import type { PortfolioEdit } from "./edits.ts";
export interface PortfolioDraft extends BlueprintDraft {
  edits: readonly PortfolioEdit[];
}
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const prefix = "manifold.declaration-draft.";
function isEdit(v: unknown): v is PortfolioEdit {
  if (typeof v !== "object" || v === null || !("kind" in v)) return false;
  if (v.kind === "add")
    return (
      "parent" in v &&
      (v.parent === null || typeof v.parent === "string") &&
      "id" in v &&
      typeof v.id === "string" &&
      "title" in v &&
      typeof v.title === "string"
    );
  if (!("item" in v) || typeof v.item !== "string") return false;
  if (v.kind === "title") return "title" in v && typeof v.title === "string";
  if (v.kind === "archive" || v.kind === "restore") return true;
  if (v.kind !== "allocation" || !("account" in v) || typeof v.account !== "string") return false;
  return ["guarantee", "ceiling", "weight", "burst"].every((k) => {
    const n = Reflect.get(v, k);
    return (
      n === undefined ||
      (k !== "guarantee" && n === null) ||
      (typeof n === "number" && Number.isFinite(n))
    );
  });
}
export function readPortfolioDraft(storage: StorageLike): PortfolioDraft | undefined {
  const draft = readDraft(storage, "portfolio.yml", prefix);
  if (!draft) return;
  if ("edits" in draft && Array.isArray(draft.edits) && draft.edits.every(isEdit)) {
    const applied = applyEdits(draft.baseText, draft.edits);
    if (applied.ok && applied.text === draft.text) return draft as PortfolioDraft;
  }
  storage.removeItem(prefix + "portfolio.yml");
}
export function writePortfolioDraft(storage: StorageLike, draft: PortfolioDraft | undefined) {
  writeDraft(storage, "portfolio.yml", draft, prefix);
}
export function appendEdit(draft: PortfolioDraft, edit: PortfolioEdit): PortfolioDraft {
  const edits = [...draft.edits, edit],
    applied = applyEdits(draft.baseText, edits);
  if (!applied.ok) return draft;
  return { base: draft.base, baseText: draft.baseText, text: applied.text, edits };
}
export function rebaseDraft(
  draft: PortfolioDraft,
  base: string,
  baseText: string,
): { draft: PortfolioDraft; dropped: readonly PortfolioEdit[] } {
  const applied = applyEdits(baseText, draft.edits);
  return {
    draft: {
      base,
      baseText,
      text: applied.ok ? applied.text : baseText,
      edits: applied.ok ? draft.edits.filter((e) => !applied.dropped.includes(e)) : [],
    } satisfies PortfolioDraft,
    dropped: applied.ok ? applied.dropped : draft.edits,
  };
}
export function settlePortfolioDraft(
  draft: PortfolioDraft,
  source: { commit: string; text: string },
  loaded: boolean,
): PortfolioDraft | undefined {
  if (!draft.saved) return draft;
  if (source.text === draft.text) return;
  return loaded ? rebaseDraft(draft, source.commit, source.text).draft : draft;
}
