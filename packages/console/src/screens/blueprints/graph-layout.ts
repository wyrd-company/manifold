// ---
// relationships:
//   implements: operator-console
// ---
import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api.js";
import type { Node, Edge } from "@xyflow/react";
import type { BlueprintGraph, GraphState } from "@wyrd-company/manifold-shared/blueprints-api";
export type StateFlowNode = Node<{ state: GraphState; problem?: "error" | "warning" }, "state">;
export async function layoutGraph(
  graph: BlueprintGraph,
): Promise<{ nodes: StateFlowNode[]; edges: Edge[] }> {
  const groups = new Map<string, ElkNode>();
  for (const state of graph.states)
    groups.set(state.path, {
      id: state.path,
      width: 200,
      height: 56,
      ...(graph.states.some((child) => child.parent === state.path)
        ? { children: [], layoutOptions: { "elk.padding": "[top=45,left=25,bottom=25,right=25]" } }
        : {}),
    });
  const children: ElkNode[] = [];
  for (const state of graph.states) {
    const node = groups.get(state.path)!;
    if (state.parent) groups.get(state.parent)!.children!.push(node);
    else children.push(node);
  }
  const edges = graph.transitions.map((edge, index) => ({
    id: `transition-${index}`,
    sources: [edge.source],
    targets: [edge.target ?? edge.source],
  }));
  const result = await new ELK().layout({
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.spacing.nodeNode": "40",
    },
    children,
    edges,
  });
  const positions = new Map<string, ElkNode>();
  function visit(nodes: readonly ElkNode[]) {
    for (const node of nodes) {
      positions.set(node.id, node);
      if (node.children) visit(node.children);
    }
  }
  visit(result.children ?? []);
  return {
    nodes: graph.states.map((state) => {
      const node = positions.get(state.path)!;
      return {
        id: state.path,
        type: "state",
        position: { x: node.x ?? 0, y: node.y ?? 0 },
        ...(state.parent ? { parentId: state.parent, extent: "parent" as const } : {}),
        style: { width: node.width ?? 200, height: node.height ?? 56 },
        data: { state },
      };
    }),
    edges: graph.transitions.map((edge, index) => ({
      id: `transition-${index}`,
      source: edge.source,
      target: edge.target ?? edge.source,
      label: (edge.guarded ? "◇ " : "") + edge.label,
      type: "smoothstep",
    })),
  };
}
