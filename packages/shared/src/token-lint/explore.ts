// ---
// relationships:
//   implements: token-lint
// ---
import { getInitialMicrosteps, getMicrosteps, getNextTransitions } from "xstate";
import type { AnyMachineSnapshot } from "xstate";
import { configurationKey, compareCodePoints } from "./configuration-key.ts";
import { ExplorationBound } from "./types.ts";
import type { Edge, Graph } from "./types.ts";
import type { lintMachine } from "./lint-machine.ts";
type LintMachine = ReturnType<typeof lintMachine>;
export function explore(lint: LintMachine, bound: number, graph: Graph) {
  const machine = lint.machine;
  const tokens = new Set(lint.gates.map((gate) => gate.token));
  function add(snapshot: AnyMachineSnapshot) {
    const key = configurationKey(machine, machine.getPersistedSnapshot(snapshot));
    if (!graph.nodes.has(key)) {
      if (graph.nodes.size >= bound) throw new ExplorationBound("configuration bound");
      graph.nodes.set(key, { snapshot, edges: [] });
    }
    return key;
  }
  function steps(event: string, snapshot?: AnyMachineSnapshot): Edge[] {
    const edges: Edge[] = [],
      scripts: boolean[][] = [[]];
    let runs = 0;
    while (scripts.length) {
      if (runs++ >= bound) throw new ExplorationBound("choice script bound");
      const script = scripts.pop()!;
      const { value: microsteps, choices } = lint.run(script, () =>
        snapshot
          ? getMicrosteps(machine, snapshot, { type: event })
          : getInitialMicrosteps(machine),
      );
      // Branch only choices beyond the supplied prefix; earlier siblings are already queued.
      for (let index = choices.length - 1; index >= script.length; index--)
        scripts.push([...choices.slice(0, index).map((choice) => choice.value), true]);
      const last = microsteps.at(-1)?.[0] ?? snapshot;
      if (!last) throw new Error("XState returned no initial snapshot");
      edges.push({
        event,
        target: add(last),
        choices,
        activeGates: microsteps.map(([snapshot]) =>
          lint.gates
            .filter((gate) =>
              snapshot._nodes.some((node) => node.path.join(".") === gate.statePath),
            )
            .map((gate) => gate.statePath),
        ),
        markers: microsteps.map(([, actions]) =>
          actions.map((action) => action.type).filter((type) => type.startsWith("token-lint:")),
        ),
      });
    }
    return edges;
  }
  graph.initial = steps("xstate.init");
  for (const node of graph.nodes.values()) {
    if (node.snapshot.status !== "active") continue;
    const descriptors = new Set(
      getNextTransitions(node.snapshot)
        .map((row) => row.eventType)
        .filter((event) => event && !event.startsWith("xstate.done.state.")),
    );
    const events = new Set<string>();
    for (const descriptor of descriptors) {
      if (!descriptor.includes("*")) events.add(descriptor);
      else {
        const prefix = descriptor === "*" ? "" : descriptor.slice(0, -1);
        let event = `${prefix}token-lint-symbol`;
        // A symbolic representative must avoid every more-specific wildcard and exact event.
        while (
          [...descriptors].some(
            (other) =>
              other !== descriptor &&
              (other.endsWith(".*")
                ? other.length - 1 > prefix.length && event.startsWith(other.slice(0, -1))
                : other === event),
          )
        )
          event += "-";
        events.add(event);
      }
    }
    for (const token of tokens) events.delete(token);
    for (const gate of lint.gates)
      if (node.snapshot._nodes.some((state) => state.path.join(".") === gate.statePath))
        events.add(gate.token);
    for (const event of [...events].sort(compareCodePoints))
      node.edges.push(...steps(event, node.snapshot));
  }
}
