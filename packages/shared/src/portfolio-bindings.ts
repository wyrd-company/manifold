// ---
// relationships:
//   implements: bindings-declaration
// ---
import type {
  BindingsDocument,
  PortfolioDeclaration,
  PortfolioFinding,
  PortfolioFindingKind,
} from "./portfolio-declaration-types.ts";
import { pointerSegment } from "./portfolio-normalization.ts";
export const githubProjectKey = (owner: string, number: number) =>
  JSON.stringify([owner.toLowerCase(), number]);
export const t3codeProjectKey = (environment: string, project: string) =>
  JSON.stringify([environment, project]);

export function lintBindings(
  document: BindingsDocument,
  items: PortfolioDeclaration["items"] | undefined,
  findings: PortfolioFinding[],
) {
  const itemIndex = items === undefined ? undefined : new Map(items.map((item) => [item.id, item]));
  const githubProjects = Object.entries(document.githubProjects ?? {}).map(([name, binding]) => ({
    ...binding,
    name,
    t3codeProjects: binding.t3codeProjects ?? [],
    archived: binding.archived ?? false,
  }));
  const t3codeProjects = Object.entries(document.t3codeProjects ?? {}).map(([name, binding]) => ({
    ...binding,
    name,
    archived: binding.archived ?? false,
  }));
  const githubKeys = new Set<string>();
  const t3Keys = new Set<string>();
  const associations = new Set<string>();
  const names = new Set(githubProjects.map((binding) => binding.name));
  const report = (kind: PortfolioFindingKind, location: string, message: string) =>
    findings.push({ file: "bindings", kind, location, message });
  function checkItem(binding: { item: string; archived: boolean }, path: string) {
    if (itemIndex === undefined) return;
    const item = itemIndex.get(binding.item);
    if (!item || item.other)
      report("unknown-item", `${path}/item`, `Unknown item "${binding.item}".`);
    else if (item.archived && !binding.archived)
      report(
        "archived-item",
        `${path}/item`,
        `Live binding names archived item "${binding.item}".`,
      );
  }
  for (const binding of githubProjects) {
    const path = `/githubProjects/${pointerSegment(binding.name)}`;
    const key = githubProjectKey(binding.owner, binding.number);
    if (githubKeys.has(key)) report("duplicate-project", path, "GitHub Project is already bound.");
    githubKeys.add(key);
    for (const [index, project] of binding.t3codeProjects.entries()) {
      const association = t3codeProjectKey(binding.environment, project);
      if (associations.has(association))
        report(
          "duplicate-association",
          `${path}/t3codeProjects/${index}`,
          "T3code project is already associated.",
        );
      associations.add(association);
    }
    checkItem(binding, path);
  }
  for (const binding of t3codeProjects) {
    const path = `/t3codeProjects/${pointerSegment(binding.name)}`;
    const key = t3codeProjectKey(binding.environment, binding.project);
    if (names.has(binding.name))
      report("duplicate-binding", path, `Duplicate binding "${binding.name}".`);
    if (t3Keys.has(key)) report("duplicate-project", path, "T3code project is already bound.");
    t3Keys.add(key);
    if (associations.has(key))
      report("bound-and-associated", path, "T3code project is both bound and associated.");
    checkItem(binding, path);
  }
  return { githubProjects, t3codeProjects };
}
