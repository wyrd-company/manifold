// ---
// relationships:
//   implements: declarations-api
// ---
import { lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";
type ItemDocument = { readonly items?: Record<string, ItemDocument> };
import type {
  ArchiveItemEdit,
  DeclarationFinding,
} from "@wyrd-company/manifold-shared/declarations-api";
import { parseDocument } from "yaml";
export function archiveItemEdit(
  files: { portfolio: string; bindings: string },
  request: ArchiveItemEdit,
):
  | { ok: true; portfolio: string; bindings: string }
  | { ok: false; findings: readonly DeclarationFinding[] } {
  const before = lintPortfolioDeclaration(files);
  if (!before.ok) return { ok: false, findings: before.findings };
  const findings: DeclarationFinding[] = [];
  const fail = (kind: string, file: "portfolio" | "bindings", message: string) =>
    findings.push({ kind, file, location: "", message });
  const item = before.declaration.items.find((item) => item.id === request.item && !item.other);
  if (!item)
    return {
      ok: false,
      findings: [
        {
          kind: "item-missing",
          file: "portfolio",
          location: "",
          message: "Expected a declared portfolio item.",
        },
      ],
    };
  const under = (id: string): boolean => {
    if (id === item.id) return true;
    const parent = before.declaration.items.find((item) => item.id === id)?.parent;
    return parent ? under(parent) : false;
  };
  const portfolio = parseDocument(files.portfolio),
    bindings = parseDocument(files.bindings);
  function itemPath(items: Record<string, ItemDocument>, path: string[]): string[] | undefined {
    for (const [id, child] of Object.entries(items)) {
      const entry = [...path, id];
      if (id === item!.id) return entry;
      const found = itemPath(child.items ?? {}, [...entry, "items"]);
      if (found) return found;
    }
    return undefined;
  }
  const document = portfolio.toJS() as { items: Record<string, ItemDocument> };
  portfolio.setIn([...itemPath(document.items, ["items"])!, "archived"], true);
  const seen = new Set<string>();
  for (const choice of request.projects) {
    if (seen.has(choice.binding)) {
      fail("duplicate-choice", "bindings", `Duplicate choice for ${choice.binding}.`);
      continue;
    }
    seen.add(choice.binding);
    const section = before.declaration.githubProjects.some(
      (binding) => binding.name === choice.binding,
    )
      ? "githubProjects"
      : "t3codeProjects";
    const binding = before.declaration[section].find((binding) => binding.name === choice.binding);
    if (!binding) {
      fail("name-missing", "bindings", `Unknown binding ${choice.binding}.`);
      continue;
    }
    if (binding.archived || !under(binding.item)) {
      fail("not-attached", "bindings", `Binding ${choice.binding} is not attached.`);
      continue;
    }
    const path = [section, choice.binding];
    if (choice.choice === "archive") bindings.setIn([...path, "archived"], true);
    else if (choice.choice === "move") {
      if (item.parent === null)
        fail("no-parent", "bindings", "A top-level item has no parent binding target.");
      else bindings.setIn([...path, "item"], item.parent);
    } else bindings.setIn([...path, "item"], choice.item);
  }
  const edited = { portfolio: portfolio.toString(), bindings: bindings.toString() };
  const lint = lintPortfolioDeclaration(edited);
  if (!lint.ok) findings.push(...lint.findings);
  return findings.length ? { ok: false, findings } : { ok: true, ...edited };
}
