// ---
// relationships:
//   implements: gate-runtime
// ---
import { compareText } from "./values.ts";
import type { GateTrackedIssue } from "./types.ts";
export function criticalPaths(tracked: (id: string) => GateTrackedIssue | undefined) {
  // A cyclic walk's answer depends on its ancestors. Cache the issue reads,
  // rather than caching a truncated length and reusing it from another root.
  const issues = new Map<string, GateTrackedIssue | undefined>();
  function read(id: string) {
    if (!issues.has(id)) issues.set(id, tracked(id));
    return issues.get(id);
  }
  function length(id: string, path: ReadonlySet<string>): number {
    const issue = read(id);
    if (!issue) return 1;
    const next = new Set(path).add(id);
    const children = issue.blocking
      .filter((i) => i.state === "open" && !next.has(i.nodeId) && read(i.nodeId))
      .map((i) => i.nodeId)
      .sort(compareText);
    return 1 + Math.max(0, ...children.map((child) => length(child, next)));
  }
  const lengths = new Map<string, number>();
  return (id: string | undefined) => {
    if (id === undefined) return 1;
    if (!lengths.has(id)) lengths.set(id, length(id, new Set()));
    return lengths.get(id)!;
  };
}
