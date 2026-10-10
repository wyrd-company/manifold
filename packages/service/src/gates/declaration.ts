// ---
// relationships:
//   implements: gate-runtime
// ---
import type { BlueprintDocument } from "@wyrd-company/manifold-shared";
import type { GateDeclaration } from "./types.ts";
export function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function declarations(document: BlueprintDocument): GateDeclaration[] {
  const result: GateDeclaration[] = [];
  function walk(node: Record<string, unknown>, path: string) {
    const gate = record(record(node["meta"])["gate"]);
    if (typeof gate["comparator"] === "string")
      result.push({
        statePath: path,
        comparator: gate["comparator"],
        reservation: gate["reservation"] === true,
        returnPoint: gate["return"] as GateDeclaration["returnPoint"],
        token: typeof gate["token"] === "string" ? gate["token"] : "token",
        ...(typeof gate["dependencies"] === "string" ? { dependencies: gate["dependencies"] } : {}),
      });
    for (const [key, child] of Object.entries(record(node["states"])))
      walk(record(child), path ? `${path}.${key}` : key);
  }
  walk(document.machine, "");
  return result;
}
export function statePaths(snapshot: import("../store/index.ts").PersistedSnapshot): string[] {
  if (snapshot.status === "error") return [];
  function walk(value: import("../store/index.ts").StateValue, prefix = ""): string[] {
    if (typeof value === "string") return [prefix ? `${prefix}.${value}` : value];
    return Object.entries(value).flatMap(([key, child]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return [path, ...walk(child, path)];
    });
  }
  return walk(snapshot.value);
}
