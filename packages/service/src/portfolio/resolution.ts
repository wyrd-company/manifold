// ---
// relationships:
//   implements: [portfolio, bindings-declaration]
// ---
import type { PortfolioDeclaration } from "@wyrd-company/manifold-shared";
import type { GitHubProjectResolution, T3codeProjectResolution } from "./types.ts";
const githubKey = (owner: string, number: number) => JSON.stringify([owner.toLowerCase(), number]);
const t3Key = (environment: string, id: string) => JSON.stringify([environment, id]);

export function resolvePortfolio(declaration: PortfolioDeclaration) {
  const github = new Map<string, GitHubProjectResolution>();
  const t3 = new Map<string, T3codeProjectResolution>();
  for (const binding of declaration.githubProjects) {
    github.set(githubKey(binding.owner, binding.number), {
      binding: binding.name,
      item: binding.item,
      environment: binding.environment,
      t3codeProjects: binding.t3codeProjects,
      archived: binding.archived,
    });
    for (const id of binding.t3codeProjects)
      t3.set(t3Key(binding.environment, id), {
        item: binding.item,
        via: "association",
        binding: binding.name,
        archived: binding.archived,
      });
  }
  for (const binding of declaration.t3codeProjects)
    t3.set(t3Key(binding.environment, binding.project), {
      item: binding.item,
      via: "binding",
      binding: binding.name,
      archived: binding.archived,
    });
  return {
    githubProject(project: { owner: string; number: number }) {
      return github.get(githubKey(project.owner, project.number));
    },
    t3codeProject(project: { environment: string; id: string }): T3codeProjectResolution {
      return t3.get(t3Key(project.environment, project.id)) ?? { item: "other", via: "unbound" };
    },
  };
}
