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
export function attachedBindings(
  read: PortfolioResponse,
  bindings: BindingsResponse,
  item: string,
) {
  function under(id: string): boolean {
    if (id === item) return true;
    const parent = read.items.find((item) => item.id === id)?.parent;
    return parent ? under(parent) : false;
  }
  return [
    ...bindings.githubProjects.map((binding) => ({ ...binding, kind: "github" as const })),
    ...bindings.t3codeProjects.map((binding) => ({ ...binding, kind: "t3code" as const })),
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
export type ArchiveChoices = Readonly<
  Record<
    string,
    | Omit<Extract<ArchiveProjectChoice, { choice: "reassign" }>, "binding">
    | { choice: "move" | "archive" }
  >
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
    const choice = choices[binding.name];
    if (!choice || (choice.choice === "reassign" && !choice.item)) return;
    if (choice.choice === "reassign")
      projects.push({ binding: binding.name, choice: "reassign", item: choice.item });
    else projects.push({ binding: binding.name, choice: choice.choice });
  }
  return { item, projects, base, saveId, message: `Archive portfolio item ${item}` };
}
