// ---
// relationships:
//   implements: intake-decision-model
// ---
import type { PortfolioDeclaration } from "@wyrd-company/manifold-shared";
import type { TrackedIssue } from "../github-source/index.ts";
import type { IntakeRecord } from "./types.ts";
import type { JsonValue } from "../store/index.ts";
export type Binding = PortfolioDeclaration["githubProjects"][number];
export const json = (value: unknown): JsonValue => JSON.parse(JSON.stringify(value)) as JsonValue;
export function descendant(
  items: PortfolioDeclaration["items"],
  id: string,
  parent: string,
): boolean {
  let current = items.find((i) => i.id === id);
  while (current) {
    if (current.id === parent) return true;
    current = items.find((i) => i.id === current?.parent);
  }
  return false;
}
export function facts(issue: TrackedIssue, projectId: string) {
  const item = issue.items.find((i) => i.project.nodeId === projectId)!;
  return {
    issue: issue.issue,
    project: item.project,
    item: item.item,
    fields: item.fields,
    blockedBy: issue.blockedBy,
    blocking: issue.blocking,
    subIssues: issue.subIssues,
    parent: issue.parent ?? null,
  };
}
export function decisionInput(
  issue: TrackedIssue,
  binding: Binding,
  declaration: PortfolioDeclaration,
  projectId: string,
) {
  return {
    task: facts(issue, projectId),
    binding: { name: binding.name, item: binding.item, environment: binding.environment },
    portfolio: {
      items: declaration.items
        .filter((i) => !i.archived && descendant(declaration.items, i.id, binding.item))
        .map(({ id, parent, title, other }) => ({ id, parent, title, other })),
    },
  };
}
export function taskInput(
  issue: TrackedIssue,
  record: Pick<IntakeRecord, "project" | "environment" | "portfolioItem" | "blueprintPath">,
  data: unknown,
): { readonly [key: string]: JsonValue } {
  return json({
    manifold: {
      issue: issue.issue.nodeId,
      project: record.project!.nodeId,
      environment: record.environment,
      portfolioItem: record.portfolioItem,
      blueprintPath: record.blueprintPath,
    },
    task: facts(issue, record.project!.nodeId),
    intake: data ?? {},
  }) as { readonly [key: string]: JsonValue };
}
