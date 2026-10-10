// ---
// relationships:
//   implements: token-lint
// ---
import { marker } from "./types.ts";
import type { Choice, Edge, Gate, GateTokenLint, Graph, TokenStep, TokenVerdict } from "./types.ts";
function trapVerdict(choices: number, endingOnly: boolean): TokenVerdict {
  if (choices > 0 || endingOnly) return "potential";
  return "violation";
}
type Phase = "eligible" | "held" | "spent";
interface Walk {
  key: string;
  phase: Phase;
  steps: TokenStep[];
  choices: (Choice & { step: number })[];
}
export function verdict(graph: Graph, gate: Gate): GateTokenLint {
  const identity = (key: string, phase: Phase) => JSON.stringify([key, phase]);
  function move(walk: Walk, edge: Edge): Walk | undefined {
    const grant = edge.event === gate.token;
    if (grant && walk.phase !== "eligible") return undefined;
    let phase: Phase = grant ? "held" : walk.phase;
    for (const [index, markers] of edge.markers.entries()) {
      if (phase === "held" && markers.includes(marker("return", gate.statePath)))
        phase = edge.activeGates[index]!.includes(gate.statePath) ? "spent" : "eligible";
      if (phase === "spent" && markers.includes(marker("exit", gate.statePath))) phase = "eligible";
    }
    const step = walk.steps.length;
    return {
      key: edge.target,
      phase,
      steps: [
        ...walk.steps,
        { event: edge.event, configuration: edge.target, ...(grant ? { grant: true } : {}) },
      ],
      choices: [...walk.choices, ...edge.choices.map((choice) => ({ ...choice, step }))],
    };
  }
  const best = new Map<string, Walk>();
  const queue: Walk[] = graph.initial.map((edge) => ({
    key: edge.target,
    phase: "eligible",
    steps: [{ event: edge.event, configuration: edge.target }],
    choices: edge.choices.map((choice) => ({ ...choice, step: 0 })),
  }));
  const held = new Set<string>(),
    safe = new Set<string>(),
    canEnd = new Set<string>(),
    reverse = new Map<string, Set<string>>();
  const better = (a: Walk, b: Walk) =>
    a.choices.length < b.choices.length ||
    (a.choices.length === b.choices.length && a.steps.length < b.steps.length);
  for (let index = 0; index < queue.length; index++) {
    const walk = queue[index]!,
      id = identity(walk.key, walk.phase),
      prior = best.get(id);
    if (prior && !better(walk, prior)) continue;
    best.set(id, walk);
    const node = graph.nodes.get(walk.key)!;
    if (node.snapshot.status !== "active") continue;
    if (walk.phase === "held") held.add(walk.key);
    for (const edge of node.edges) {
      const next = move(walk, edge);
      if (!next) continue;
      if (walk.phase === "held") {
        if (edge.markers.some((markers) => markers.includes(marker("return", gate.statePath))))
          safe.add(walk.key);
        else if (graph.nodes.get(next.key)!.snapshot.status === "done") canEnd.add(walk.key);
        else if (graph.nodes.get(next.key)!.snapshot.status === "active" && next.phase === "held") {
          const predecessors = reverse.get(next.key) ?? new Set<string>();
          predecessors.add(walk.key);
          reverse.set(next.key, predecessors);
        }
      }
      queue.push(next);
    }
  }
  function propagate(seeds: Set<string>) {
    const pending = [...seeds];
    for (let index = 0; index < pending.length; index++)
      for (const key of reverse.get(pending[index]!) ?? [])
        if (!seeds.has(key)) {
          seeds.add(key);
          pending.push(key);
        }
  }
  propagate(safe);
  propagate(canEnd);
  const traps = new Set([...held].filter((key) => !safe.has(key)));
  let witness: Walk | undefined;
  let result: TokenVerdict = "potential";
  for (const key of traps) {
    const walk = best.get(identity(key, "held"))!;
    const candidate = trapVerdict(walk.choices.length, canEnd.has(key));
    if (
      !witness ||
      (candidate === "violation" && result !== "violation") ||
      (candidate === result && better(walk, witness))
    ) {
      witness = walk;
      result = candidate;
    }
  }
  if (!witness) return { ...gate, verdict: "proved", findings: [], traps };
  return {
    statePath: gate.statePath,
    location: gate.location,
    verdict: result,
    traps,
    findings: [
      {
        path: "",
        kind: result === "violation" ? "token-violation" : "token-potential",
        location: gate.location,
        gate: gate.statePath,
        steps: witness.steps,
        ...(result === "potential" && witness.choices.length > 0
          ? { choices: witness.choices }
          : {}),
        message: `${result}: no route reaches the return point${canEnd.has(witness.key) ? "; only actor completion can return the token" : ""}; ${witness.steps.map((step) => `${step.event}${step.grant ? " (grant)" : ""} -> ${step.configuration}`).join("; ")}`,
      },
    ],
  };
}
