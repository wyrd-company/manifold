// ---
// relationships:
//   verifies: [retention, usage-intake]
// ---
import type { T3CodeSource } from "../../t3code-source/index.ts";
// Structural stand-in for the in-flight effective-ownership seam. Replace at rebase
// with the portfolio's resolution and usageItem, including a parent's Other item.
export function projectOwnership(source: T3CodeSource, environment: string, projectId: string) {
  const record = source.createdProject(environment, projectId);
  return record ? { actorId: record.actorId, usageItem: record.item } : undefined;
}
