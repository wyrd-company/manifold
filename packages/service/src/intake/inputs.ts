// ---
// relationships:
//   implements: intake-decision-model
// ---
import { createHash } from "node:crypto";
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
    item: { nodeId: item.nodeId, archived: item.archived },
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
    binding: {
      name: binding.name,
      item: binding.item,
      environment: binding.environment,
      t3codeProjects: [...binding.t3codeProjects],
    },
    portfolio: {
      items: declaration.items
        .filter((i) => !i.archived && descendant(declaration.items, i.id, binding.item))
        .map(({ id, parent, title, other }) => ({ id, parent, title, other })),
    },
  };
}
export function taskInput(
  issue: TrackedIssue,
  record: Pick<
    IntakeRecord,
    "project" | "environment" | "portfolioItem" | "blueprintPath" | "evaluation"
  >,
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
    binding: (record.evaluation as { input: { binding: unknown } }).input.binding,
    intake: data ?? {},
  }) as { readonly [key: string]: JsonValue };
}

/** Canonicalize keys and unordered mirror collections before hashing. */
export function issueDigest(issue: TrackedIssue): string {
  const order = (a: string, b: string) => {
    const left = Array.from(a, (c) => c.codePointAt(0)!),
      right = Array.from(b, (c) => c.codePointAt(0)!);
    for (let i = 0; i < Math.min(left.length, right.length); i++)
      if (left[i] !== right[i]) return left[i]! - right[i]!;
    return left.length - right.length;
  };
  const nodes = <T extends { readonly nodeId: string }>(values: readonly T[]) =>
    [...values].sort((a, b) => order(a.nodeId, b.nodeId));
  function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (value !== null && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => order(a, b))
          .map(([key, child]) => [key, canonical(child)]),
      );
    return value;
  }
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonical({
          ...issue,
          parent: issue.parent ?? null,
          blockedBy: nodes(issue.blockedBy),
          blocking: nodes(issue.blocking),
          subIssues: nodes(issue.subIssues),
          projects: nodes(issue.projects),
          items: [...issue.items].sort((a, b) => order(a.project.nodeId, b.project.nodeId)),
        }),
      ),
    )
    .digest("hex");
}
