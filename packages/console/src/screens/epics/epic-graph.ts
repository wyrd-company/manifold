// ---
// relationships:
//   implements: operator-console
// ---
import type { Epic } from "@wyrd-company/manifold-shared/epics-api";
export interface GraphEdge {
  readonly id: string;
  readonly blocking: string;
  readonly blocked: string;
  readonly cyclic: boolean;
}
export interface EpicGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly GraphEdge[];
  open(nodeId: string): boolean;
}
export interface Chain {
  readonly nodes: readonly string[];
  readonly edges: readonly string[];
  readonly open: number;
}
export interface Focus {
  readonly nodes: ReadonlySet<string>;
  readonly edges: ReadonlySet<string>;
}
export interface EmphasisState {
  readonly hovered?: string;
  readonly selected?: string;
  readonly criticalPath: boolean;
  readonly fadeCompleted: boolean;
}
export interface Emphasis {
  readonly nodes: ReadonlyMap<string, number>;
  readonly edges: ReadonlyMap<string, number>;
  readonly critical: ReadonlySet<string>;
}
export function epicGraph(epic: Epic): EpicGraph {
  const nodes = epic.issues
    .filter(
      (i) =>
        i.placement !== "root" ||
        epic.dependencies.some((e) => e.blocking === epic.root || e.blocked === epic.root),
    )
    .map((i) => i.issue.nodeId);
  const outgoing = new Map(
    nodes.map((id) => [
      id,
      epic.dependencies.filter((e) => e.blocking === id).map((e) => e.blocked),
    ]),
  );
  // Tarjan components contain every cycle. Removing their internal edges leaves a DAG.
  const index = new Map<string, number>(),
    low = new Map<string, number>(),
    stack: string[] = [],
    active = new Set<string>(),
    component = new Map<string, number>();
  let cursor = 0,
    group = 0;
  function visit(id: string) {
    index.set(id, cursor);
    low.set(id, cursor++);
    stack.push(id);
    active.add(id);
    for (const next of outgoing.get(id)!) {
      if (!index.has(next)) {
        visit(next);
        low.set(id, Math.min(low.get(id)!, low.get(next)!));
      } else if (active.has(next)) low.set(id, Math.min(low.get(id)!, index.get(next)!));
    }
    if (low.get(id) === index.get(id)) {
      let next: string;
      do {
        next = stack.pop()!;
        active.delete(next);
        component.set(next, group);
      } while (next !== id);
      group++;
    }
  }
  for (const id of nodes) if (!index.has(id)) visit(id);
  const open = new Set(
    epic.issues.filter((i) => i.issue.state === "open").map((i) => i.issue.nodeId),
  );
  return {
    nodes,
    edges: epic.dependencies.map((e) => ({
      ...e,
      id: `${e.blocking}->${e.blocked}`,
      cyclic: component.get(e.blocking) === component.get(e.blocked),
    })),
    open: (id) => open.has(id),
  };
}
const empty: Chain = { nodes: [], edges: [], open: 0 };
export function criticalPath(graph: EpicGraph, through?: string): Chain {
  const indexes = new Map(graph.nodes.map((id, i) => [id, i]));
  const edges = graph.edges.filter((e) => !e.cyclic);
  const incoming = new Map(graph.nodes.map((id) => [id, edges.filter((e) => e.blocked === id)])),
    outgoing = new Map(graph.nodes.map((id) => [id, edges.filter((e) => e.blocking === id)]));
  // Open work wins, then the shortest chain, then the earliest sequence in API order.
  function best(a: Chain, b: Chain): Chain {
    if (a.open !== b.open) return a.open > b.open ? a : b;
    if (a.nodes.length !== b.nodes.length) return a.nodes.length < b.nodes.length ? a : b;
    for (let i = 0; i < a.nodes.length; i++) {
      const delta = indexes.get(a.nodes[i]!)! - indexes.get(b.nodes[i]!)!;
      if (delta) return delta < 0 ? a : b;
    }
    return a;
  }
  const before = new Map<string, Chain>(),
    after = new Map<string, Chain>();
  const indegree = new Map(graph.nodes.map((id) => [id, incoming.get(id)!.length]));
  const queue = graph.nodes.filter((id) => indegree.get(id) === 0),
    order: string[] = [];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    order.push(id);
    for (const e of outgoing.get(id)!) {
      indegree.set(e.blocked, indegree.get(e.blocked)! - 1);
      if (indegree.get(e.blocked) === 0) queue.push(e.blocked);
    }
  }
  const single = (id: string): Chain => ({ nodes: [id], edges: [], open: Number(graph.open(id)) });
  for (const id of order) {
    let chain = single(id);
    for (const e of incoming.get(id)!) {
      const p = before.get(e.blocking)!;
      chain = best(chain, {
        nodes: [...p.nodes, id],
        edges: [...p.edges, e.id],
        open: p.open + Number(graph.open(id)),
      });
    }
    before.set(id, chain);
  }
  for (const id of order.toReversed()) {
    let chain = single(id);
    for (const e of outgoing.get(id)!) {
      const p = after.get(e.blocked)!;
      chain = best(chain, {
        nodes: [id, ...p.nodes],
        edges: [e.id, ...p.edges],
        open: p.open + Number(graph.open(id)),
      });
    }
    after.set(id, chain);
  }
  const joined = (id: string): Chain => {
    const a = before.get(id)!,
      b = after.get(id)!;
    return {
      nodes: [...a.nodes, ...b.nodes.slice(1)],
      edges: [...a.edges, ...b.edges],
      open: a.open + b.open - Number(graph.open(id)),
    };
  };
  if (through) return indexes.has(through) ? joined(through) : empty;
  return graph.nodes.reduce((chain, id) => best(chain, joined(id)), empty);
}
export function neighborhood(graph: EpicGraph, nodeId: string): Focus {
  const edges = graph.edges.filter((e) => e.blocking === nodeId || e.blocked === nodeId);
  return {
    nodes: new Set([nodeId, ...edges.flatMap((e) => [e.blocking, e.blocked])]),
    edges: new Set(edges.map((e) => e.id)),
  };
}
export function epicEmphasis(graph: EpicGraph, state: EmphasisState): Emphasis {
  const selected =
    state.selected && graph.nodes.includes(state.selected) ? state.selected : undefined;
  const chain = selected
    ? criticalPath(graph, selected)
    : state.criticalPath
      ? criticalPath(graph)
      : empty;
  const focus = state.hovered
    ? neighborhood(graph, state.hovered)
    : selected
      ? { nodes: new Set(chain.nodes), edges: new Set(chain.edges) }
      : undefined;
  const fade = state.fadeCompleted && !state.hovered && !selected;
  return {
    nodes: new Map(
      graph.nodes.map((id) => [
        id,
        focus && !focus.nodes.has(id) ? 0.3 : fade && !graph.open(id) ? 0.55 : 1,
      ]),
    ),
    edges: new Map(
      graph.edges.map((e) => [
        e.id,
        focus && !focus.edges.has(e.id) ? 0.1 : fade && !graph.open(e.blocking) ? 0.25 : 1,
      ]),
    ),
    critical: new Set(chain.edges),
  };
}
