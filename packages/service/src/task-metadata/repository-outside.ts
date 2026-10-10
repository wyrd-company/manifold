// ---
// relationships:
//   implements: task-metadata
// ---
import { repositoryInScope } from "@wyrd-company/manifold-shared";
import type { ProjectMetadata } from "@wyrd-company/manifold-shared";
import type { TrackedIssueIndex } from "../github-source/index.ts";
/** Outside issues remain tasks, with repository storage unavailable. */
export function outsideRepositories(
  metadata: ProjectMetadata | undefined,
  projectNodeId: string,
  issues: TrackedIssueIndex | undefined,
) {
  if (
    !metadata ||
    !Object.values(metadata.fields).some(
      (f) => f.storage.kind === "label" || f.storage.kind === "milestone",
    )
  )
    return [];
  const counts = new Map<string, number>();
  for (const issue of issues?.values() ?? [])
    if (
      issue.items.some((item) => item.project.nodeId === projectNodeId) &&
      !repositoryInScope(metadata.repositories ?? [], issue.issue.repository)
    ) {
      const repository = issue.issue.repository.toLowerCase();
      counts.set(repository, (counts.get(repository) ?? 0) + 1);
    }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([repository, issues]) => ({ repository, issues }));
}
