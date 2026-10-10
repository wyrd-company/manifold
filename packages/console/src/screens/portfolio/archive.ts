// ---
// relationships:
//   implements: operator-console
// ---
import type {
  BindingsResponse,
  ArchiveItemRequest,
  ArchiveProjectChoice,
} from "@wyrd-company/manifold-shared/declarations-api";
import type { PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
export function createdBindingName(text: string, names: readonly string[]) {
  const slug =
    "t3-" +
    (text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "project");
  let candidate = slug.slice(0, 64).replace(/-$/, "");
  for (let n = 2; names.includes(candidate); n++) {
    const suffix = `-${n}`;
    candidate = slug.slice(0, 64 - suffix.length).replace(/-$/, "") + suffix;
  }
  return candidate;
}
export function attachedBindings(
  read: PortfolioResponse,
  bindings: BindingsResponse,
  item: string,
  retainedNames: Readonly<Record<string, string>> = {},
) {
  function under(id: string): boolean {
    if (id === item) return true;
    const parent = read.items.find((item) => item.id === id)?.parent;
    return parent ? under(parent) : false;
  }
  const names = [...bindings.githubProjects, ...bindings.t3codeProjects]
    .map((b) => b.name)
    .concat(Object.values(retainedNames));
  const created = bindings.createdProjects.map((project) => {
    const title =
      bindings.environments
        .find((e) => e.name === project.environment)
        ?.projects?.find((p) => p.id === project.project)?.title ?? project.project;
    const key = JSON.stringify([project.environment, project.project]);
    const name = retainedNames[key] ?? createdBindingName(title, names);
    names.push(name);
    return { ...project, title, name, archived: false, kind: "created" as const };
  });
  return [
    ...bindings.githubProjects.map((binding) => ({ ...binding, kind: "github" as const })),
    ...bindings.t3codeProjects.map((binding) => ({ ...binding, kind: "t3code" as const })),
    ...created,
  ].filter((binding) => !binding.archived && under(binding.item));
}
export function siblingTargets(read: PortfolioResponse, bindings: BindingsResponse, item: string) {
  const parent = read.items.find((i) => i.id === item)?.parent;
  return bindings.items.filter(
    (i) =>
      i.id !== item &&
      read.items.some(
        (row) => row.id === i.id && row.parent === parent && !row.other && !row.archived,
      ),
  );
}
export function archiveRowKey(row: ReturnType<typeof attachedBindings>[number]) {
  return row.kind === "created" ? JSON.stringify([row.environment, row.project]) : row.name;
}
export type ArchiveChoices = Readonly<
  Record<string, { choice: "reassign"; item: string } | { choice: "move" } | { choice: "archive" }>
>;
export function archiveRequest(
  item: string,
  bindings: ReturnType<typeof attachedBindings>,
  choices: ArchiveChoices,
  base: string,
  saveId: string,
): ArchiveItemRequest | undefined {
  const projects: ArchiveProjectChoice[] = [];
  for (const binding of bindings) {
    const choice = choices[archiveRowKey(binding)];
    if (!choice || (choice.choice === "reassign" && !choice.item)) return;
    const target =
      binding.kind === "created"
        ? {
            created: { environment: binding.environment, project: binding.project },
            name: binding.name,
          }
        : { binding: binding.name };
    projects.push({ ...target, ...choice });
  }
  return { item, projects, base, saveId, message: `Archive portfolio item ${item}` };
}
