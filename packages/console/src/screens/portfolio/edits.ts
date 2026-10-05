// ---
// relationships:
//   implements: operator-console
// ---
import { parseDocument, isMap, YAMLMap, type Document } from "yaml";
export type PortfolioEdit =
  | {
      readonly kind: "allocation";
      readonly item: string;
      readonly account: string;
      readonly guarantee?: number;
      readonly ceiling?: number | null;
      readonly weight?: number | null;
      readonly burst?: number | null;
    }
  | { readonly kind: "title"; readonly item: string; readonly title: string }
  | {
      readonly kind: "add";
      readonly parent: string | null;
      readonly id: string;
      readonly title: string;
    }
  | { readonly kind: "archive" | "restore"; readonly item: string };
export function itemId(name: string, ids: readonly string[]): string {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (!/^[a-z]/.test(slug)) slug = "item-" + slug;
  let candidate = slug.slice(0, 64);
  for (let n = 2; ids.includes(candidate) || candidate === "other"; n++) {
    const suffix = `-${n}`;
    candidate = slug.slice(0, 64 - suffix.length).replace(/-$/, "") + suffix;
  }
  return candidate;
}
export function applyEdits(
  text: string,
  edits: readonly PortfolioEdit[],
):
  | { readonly ok: true; readonly text: string; readonly dropped: readonly PortfolioEdit[] }
  | { readonly ok: false } {
  const doc: Document = parseDocument(text);
  if (doc.errors.length || (doc.contents !== null && !isMap(doc.contents))) return { ok: false };
  if (!doc.contents) doc.contents = new YAMLMap();
  function mapping(node: YAMLMap, key: string) {
    const existing = node.get(key, true);
    if (isMap(existing)) return existing;
    const value = new YAMLMap();
    node.set(key, value);
    return value;
  }
  function find(id: string, node: unknown = doc.get("items", true)): YAMLMap | undefined {
    if (!isMap(node)) return;
    if (id === "other") {
      const other = node.get("other", true);
      return isMap(other) ? other : undefined;
    }
    for (const pair of node.items) {
      const key = String(pair.key);
      if (!isMap(pair.value)) continue;
      if (key === id) return pair.value;
      const child = find(id, pair.value.get("items", true) ?? null);
      if (child) return child;
    }
  }
  function target(id: string) {
    if (id === "other") return mapping(mapping(doc.contents as YAMLMap, "items"), "other");
    if (id.endsWith("/other")) {
      const parent = find(id.slice(0, -6));
      return parent ? mapping(mapping(parent, "items"), "other") : undefined;
    }
    return find(id);
  }
  function resetGuarantees(node: YAMLMap) {
    const allocations = node.get("allocations", true);
    if (isMap(allocations))
      for (const a of allocations.items)
        if (isMap(a.value) && a.value.has("guarantee")) a.value.set("guarantee", 0);
    const children = node.get("items", true);
    if (isMap(children))
      for (const c of children.items) if (isMap(c.value)) resetGuarantees(c.value);
  }
  const dropped: PortfolioEdit[] = [];
  for (const edit of edits) {
    if (edit.kind === "add") {
      const parent = edit.parent === null ? (doc.contents as YAMLMap) : find(edit.parent);
      if (!parent || find(edit.id) || edit.id === "other") {
        dropped.push(edit);
        continue;
      }
      mapping(parent, "items").set(edit.id, doc.createNode({ title: edit.title }));
      continue;
    }
    const node = target(edit.item);
    if (!node) {
      dropped.push(edit);
      continue;
    }
    if (edit.kind === "title") {
      if (edit.title === edit.item) node.delete("title");
      else node.set("title", edit.title);
    }
    if (edit.kind === "archive") node.set("archived", true);
    if (edit.kind === "restore") {
      node.delete("archived");
      resetGuarantees(node);
    }
    if (edit.kind === "allocation") {
      const row = mapping(mapping(node, "allocations"), edit.account);
      for (const field of ["guarantee", "ceiling", "weight"] as const) {
        const value = edit[field];
        if (value === null) row.delete(field);
        else if (value !== undefined) row.set(field, value);
      }
      if (edit.burst === null) row.delete("pacing");
      else if (edit.burst !== undefined) mapping(row, "pacing").set("burst", edit.burst);
    }
  }
  return { ok: true, text: doc.toString(), dropped };
}
