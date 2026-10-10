// ---
// relationships:
//   implements: operator-console
// ---
import type { BoundProject } from "@wyrd-company/manifold-shared/tasks-api";
export function boardLanes(project: BoundProject) {
  const options = project.lifecycle?.options ?? [];
  const unset = project.tasks.filter((t) => t.status === null || !options.includes(t.status));
  return [
    ...(unset.length ? [{ name: "No status", tasks: unset }] : []),
    ...options.map((name) => ({ name, tasks: project.tasks.filter((t) => t.status === name) })),
  ];
}
const key = "manifold.board.collapsed";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
function collapsed(storage: Storage | undefined): Record<string, string[]> {
  try {
    const value: unknown = JSON.parse(storage?.getItem(key) ?? "{}");
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([, v]) => Array.isArray(v) && v.every((s) => typeof s === "string"),
      ),
    );
  } catch {
    return {};
  }
}
export function readCollapsed(storage: Storage | undefined, project: string): string[] {
  return collapsed(storage)[project] ?? [];
}
export function writeCollapsed(
  storage: Storage | undefined,
  project: string,
  lanes: readonly string[],
) {
  try {
    storage?.setItem(key, JSON.stringify({ ...collapsed(storage), [project]: lanes }));
  } catch {
    /* Storage can be unavailable. The page still works. */
  }
}
export function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
