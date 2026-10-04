// ---
// relationships:
//   implements: blueprint
// ---
import { record } from "./expression-sites.ts";
import type { BlueprintDocument, BlueprintFinding } from "./blueprint-lint.ts";
export function gateFindings(document: BlueprintDocument, path: string): BlueprintFinding[] {
  const states = new Map<string, Record<string, unknown>>();
  const gates: { statePath: string; location: string; declaration: Record<string, unknown> }[] = [];
  function walk(config: Record<string, unknown>, statePath: string, location: string) {
    states.set(statePath, config);
    const declaration = record(record(config["meta"])["gate"]);
    if (Object.keys(declaration).length)
      gates.push({ statePath, location: `${location}/meta/gate`, declaration });
    for (const [key, child] of Object.entries(record(config["states"])))
      walk(
        record(child),
        statePath ? `${statePath}.${key}` : key,
        `${location}/states/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
      );
  }
  walk(document.machine, "", "/machine");
  const findings: BlueprintFinding[] = [],
    tokens = new Set<string>();
  for (const gate of gates) {
    const fail = (message: string) =>
      findings.push({ path, kind: "gate", location: gate.location, message });
    if (!gate.statePath) fail("The root cannot declare a gate");
    const returned = gate.declaration["return"];
    if (returned !== "exit") {
      const state = record(returned)["state"] as string;
      if (!states.has(state) || gate.statePath === state || gate.statePath.startsWith(`${state}.`))
        fail("Return must name an existing state other than the gated state or its ancestors");
    }
    const dependencies = gate.declaration["dependencies"] as string | undefined;
    if (dependencies !== undefined) {
      const children = Object.keys(record(states.get(dependencies)?.["states"])).sort();
      if (children.length !== 2 || children[0] !== "blocked" || children[1] !== "clear")
        fail("Dependencies must name a state with exactly blocked and clear children");
    }
    const token = (gate.declaration["token"] as string) ?? "token";
    if (tokens.has(token)) fail("Token event types must be unique among gates");
    tokens.add(token);
  }
  return findings.sort((a, b) => (a.location < b.location ? -1 : a.location > b.location ? 1 : 0));
}
