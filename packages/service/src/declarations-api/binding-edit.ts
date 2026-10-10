// ---
// relationships:
//   implements: declarations-api
// ---
import { parseDocument, isMap } from "yaml";
import type { BindingEdit } from "@wyrd-company/manifold-shared/declarations-api";
export function editBindings(text: string, edit: BindingEdit) {
  const doc = parseDocument(text, { version: "1.2" });
  if (doc.errors.length)
    return {
      ok: false as const,
      findings: [{ kind: "syntax", location: "", message: doc.errors[0]!.message }],
    };
  const section = edit.kind === "github-project" ? "githubProjects" : "t3codeProjects";
  const location = `/${section}/${edit.name.replaceAll("~", "~0").replaceAll("/", "~1")}`;
  const exists = doc.hasIn([section, edit.name]);
  if (
    edit.mode === "add" &&
    (doc.hasIn(["githubProjects", edit.name]) || doc.hasIn(["t3codeProjects", edit.name]))
  )
    return {
      ok: false as const,
      findings: [{ kind: "name-taken", location, message: "Binding name is already used." }],
    };
  if (edit.mode === "replace" && !exists)
    return {
      ok: false as const,
      findings: [{ kind: "name-missing", location, message: "Binding does not exist." }],
    };
  if (edit.mode === "add") doc.setIn([section, edit.name], doc.createNode({}));
  const node = doc.getIn([section, edit.name], true);
  if (!isMap(node))
    return {
      ok: false as const,
      findings: [{ kind: "schema", location, message: "Expected a binding mapping." }],
    };
  for (const [key, value] of Object.entries(edit))
    if (!["kind", "mode", "name"].includes(key)) {
      if (key === "t3codeProjects" && Array.isArray(value) && !value.length) node.delete(key);
      else node.set(key, doc.createNode(value));
    }
  return { ok: true as const, text: doc.toString({ lineWidth: 0 }), location };
}
