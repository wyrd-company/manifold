// ---
// relationships:
//   implements: operator-console
// ---
import type { BindingsResponse } from "@wyrd-company/manifold-shared/declarations-api";
import type { BoundProject } from "@wyrd-company/manifold-shared/tasks-api";
import type { ProjectSummary } from "../../api/projects.ts";
export function projectRows(
  projects: readonly ProjectSummary[],
  tasks: readonly BoundProject[] | undefined,
  bindings?: BindingsResponse,
) {
  return projects.map((project) => {
    const cards = tasks?.find((p) => p.binding === project.binding)?.tasks;
    return {
      ...project,
      itemTitle:
        bindings?.items.find((item) => item.id === project.portfolioItem)?.title ??
        project.portfolioItem,
      active: cards?.filter((t) => t.issue.state === "open").length,
      completed: cards?.filter((t) => t.issue.state === "closed").length,
    };
  });
}
export function t3codeRows(bindings: BindingsResponse) {
  const rows = [
    ...bindings.t3codeProjects
      .filter((b) => !b.archived)
      .map((b) => ({
        name: b.name,
        environment: b.environment,
        id: b.project,
        item: b.item,
        associated: undefined as string | undefined,
      })),
    ...bindings.githubProjects
      .filter((b) => !b.archived)
      .flatMap((b) =>
        b.t3codeProjects.map((id) => ({
          name: b.name,
          environment: b.environment,
          id,
          item: b.item,
          associated: `${b.owner}/${b.number}`,
        })),
      ),
  ];
  return rows
    .map((row) => {
      const environment = bindings.environments.find((e) => e.name === row.environment);
      const project = environment?.projects?.find((p) => p.id === row.id);
      return {
        ...row,
        title: project?.title ?? row.id,
        workspaceRoot: project?.workspaceRoot,
        activeThreads: project?.activeThreads,
        missing: !!environment?.projects && !project,
        itemTitle: bindings.items.find((i) => i.id === row.item)?.title ?? row.item,
      };
    })
    .sort(
      (a, b) =>
        a.environment.localeCompare(b.environment) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
}
