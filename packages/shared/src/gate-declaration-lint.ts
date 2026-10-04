// ---
// relationships:
//   implements: blueprint
// ---
import type { BlueprintDocument, BlueprintFinding } from "./blueprint-lint.ts";
import { record } from "./expression-sites.ts";
export function lintGateDeclarations(
  document: BlueprintDocument,
  path: string,
): BlueprintFinding[] {
  const nodes = new Map<string, { node: Record<string, unknown>; location: string }>();
  function walk(node: Record<string, unknown>, statePath: string, location: string) {
    nodes.set(statePath, { node, location });
    for (const [key, child] of Object.entries(record(node["states"])))
      walk(
        record(child),
        statePath ? `${statePath}.${key}` : key,
        `${location}/states/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
      );
  }
  walk(document.machine, "", "/machine");
  const result: BlueprintFinding[] = [],
    tokens = new Set<string>();
  for (const [statePath, { node, location }] of nodes) {
    const gate = record(record(node["meta"])["gate"]);
    if (!Object.keys(gate).length) continue;
    const at = `${location}/meta/gate`,
      fail = (message: string) => result.push({ path, kind: "gate", location: at, message });
    if (!statePath) fail("A gate cannot be declared on the root");
    const point = record(gate["return"])["state"];
    if (
      typeof point === "string" &&
      (!nodes.has(point) || point === statePath || statePath.startsWith(`${point}.`))
    )
      fail("Return state must exist and cannot be the gated state or its ancestor");
    const dependency = gate["dependencies"];
    if (typeof dependency === "string") {
      const children = Object.keys(record(nodes.get(dependency)?.node["states"])).sort();
      if (children.join(",") !== "blocked,clear")
        fail("Dependencies region must have exactly blocked and clear children");
    }
    const token = typeof gate["token"] === "string" ? gate["token"] : "token";
    if (tokens.has(token)) fail("Token event type must be unique per gate");
    tokens.add(token);
  }
  return result.sort((a, b) => (a.location < b.location ? -1 : a.location > b.location ? 1 : 0));
}
