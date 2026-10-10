// ---
// relationships:
//   implements: store
// ---
import type { StateValue } from "./types.ts";
export function statePaths(value: StateValue, prefix = ""): string[] {
  if (typeof value === "string") return [prefix ? `${prefix}.${value}` : value];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return [path, ...statePaths(child, path)];
  });
}
