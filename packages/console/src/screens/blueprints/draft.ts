// ---
// relationships:
//   implements: operator-console
// ---
export interface BlueprintDraft {
  base: string;
  baseText: string;
  text: string;
  saveId?: string;
  message?: string;
  saved?: string;
}
type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (path: string) => `manifold.blueprint-draft.${path}`;
export function readDraft(storage: DraftStorage, path: string): BlueprintDraft | undefined {
  const value = storage.getItem(key(path));
  if (value === null) return;
  try {
    const draft: unknown = JSON.parse(value);
    if (
      typeof draft === "object" &&
      draft !== null &&
      "base" in draft &&
      typeof draft.base === "string" &&
      "baseText" in draft &&
      typeof draft.baseText === "string" &&
      "text" in draft &&
      typeof draft.text === "string" &&
      ["saveId", "message", "saved"].every(
        (name) => !(name in draft) || typeof Reflect.get(draft, name) === "string",
      )
    )
      return draft as BlueprintDraft;
  } catch {
    /* A malformed draft cannot be recovered. */
  }
  storage.removeItem(key(path));
}
export function writeDraft(storage: DraftStorage, path: string, draft: BlueprintDraft | undefined) {
  if (!draft || (draft.text === draft.baseText && !draft.saved)) storage.removeItem(key(path));
  else storage.setItem(key(path), JSON.stringify(draft));
}
export function changeDraft(draft: BlueprintDraft, text: string): BlueprintDraft {
  return { base: draft.base, baseText: draft.baseText, text };
}
export function savedDraft(draft: BlueprintDraft, commit: string): BlueprintDraft {
  return { ...draft, saved: commit };
}
export function settleDraft(
  draft: BlueprintDraft,
  source: { commit?: string; text: string },
  loaded: boolean,
): BlueprintDraft | undefined {
  if (!draft.saved) return draft;
  if (source.text === draft.text) return;
  if (loaded && source.commit)
    return { base: source.commit, baseText: source.text, text: draft.text };
  return draft;
}
export function createSaveId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
