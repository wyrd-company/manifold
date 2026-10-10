// ---
// relationships:
//   implements: operator-console
// ---
import { isMap, parseDocument, type Document } from "yaml";
import type { UsageAccount } from "@wyrd-company/manifold-shared";
export type AccountValues = Pick<UsageAccount, "kind" | "capacity"> & {
  usage: NonNullable<UsageAccount["usage"]>;
};
export type AccountEdit =
  | { kind: "add"; name: string; account: AccountValues }
  | {
      kind: "set";
      name: string;
      capacity?: AccountValues["capacity"];
      usage?: AccountValues["usage"];
    }
  | { kind: "archive"; name: string }
  | { kind: "restore"; name: string };
export function applyAccountEdit(
  text: string,
  edit: AccountEdit,
):
  | { ok: true; text: string }
  | { ok: false; reason: "unparsable" | "name-taken" | "name-missing" } {
  const doc: Document = parseDocument(text);
  if (doc.errors.length || (doc.contents !== null && !isMap(doc.contents)))
    return { ok: false, reason: "unparsable" };
  if (!doc.contents) doc.contents = doc.createNode({});
  if (doc.has("accounts") && !isMap(doc.get("accounts")))
    return { ok: false, reason: "unparsable" };
  const path = ["accounts", edit.name];
  if (edit.kind === "add") {
    if (doc.hasIn(path)) return { ok: false, reason: "name-taken" };
    if (!doc.has("accounts")) doc.set("accounts", doc.createNode({}));
    const { usage, ...values } = edit.account;
    doc.setIn(path, doc.createNode({ unit: "usd", ...values, ...(usage.length ? { usage } : {}) }));
  } else {
    if (!doc.hasIn(path)) return { ok: false, reason: "name-missing" };
    if (edit.kind === "archive") doc.setIn([...path, "archived"], true);
    else if (edit.kind === "restore") doc.deleteIn([...path, "archived"]);
    else {
      if (edit.capacity) doc.setIn([...path, "capacity"], doc.createNode(edit.capacity));
      if (edit.usage) {
        if (edit.usage.length) doc.setIn([...path, "usage"], doc.createNode(edit.usage));
        else doc.deleteIn([...path, "usage"]);
      }
    }
  }
  return { ok: true, text: doc.toString() };
}
