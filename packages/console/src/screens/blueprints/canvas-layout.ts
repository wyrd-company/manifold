// ---
// relationships:
//   implements: operator-console
// ---
import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode, ElkExtendedEdge } from "elkjs/lib/elk-api.js";
import type { Node, Edge } from "@xyflow/react";
import type {
  BlueprintGraph,
  GraphState,
  GraphTransition,
} from "@wyrd-company/manifold-shared/blueprints-api";
export interface BlueprintLayout {
  states: Record<string, { x: number; y: number }>;
}
export type CanvasNode = Node<
  {
    state: GraphState;
    problem?: "error" | "warning" | undefined;
    changed?: boolean;
    history?: "deep" | "shallow";
  },
  "state" | "initial"
>;
export type CanvasEdge = Edge<
  {
    transition?: GraphTransition;
    points?: { x: number; y: number }[];
    labelPosition?: { x: number; y: number };
    problem?: "error" | "warning" | undefined;
  },
  "transition"
>;
export const transitionLabel = (edge: GraphTransition) =>
  (edge.guarded ? "◇ " : "") +
  (edge.trigger === "always"
    ? "always"
    : edge.trigger === "after"
      ? "◷ " +
        edge.label +
        (/^\d+$/.test(edge.label)
          ? " · " +
            (Number(edge.label) >= 3600000
              ? Number(edge.label) / 3600000 + "h"
              : Number(edge.label) >= 60000
                ? Number(edge.label) / 60000 + "m"
                : Number(edge.label) / 1000 + "s")
          : "")
      : edge.trigger === "done"
        ? "✓ done · " + edge.label
        : edge.trigger === "error"
          ? "! error · " + edge.label
          : edge.label);
export async function layoutCanvas(
  graph: BlueprintGraph,
  layout: BlueprintLayout | undefined,
  measure: (label: string) => number,
): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] }> {
  const groups = new Map<string, ElkNode>();
  for (const state of graph.states)
    groups.set(state.path, {
      id: state.path,
      width: state.type === "history" ? 40 : 200,
      height: state.type === "history" ? 40 : 56,
      ...(graph.states.some((child) => child.parent === state.path)
        ? { children: [], layoutOptions: { "elk.padding": "[top=48,left=24,bottom=24,right=24]" } }
        : {}),
    });
  const children: ElkNode[] = [];
  for (const state of graph.states) {
    const node = groups.get(state.path)!;
    if (state.parent) groups.get(state.parent)!.children!.push(node);
    else children.push(node);
  }
  const initialStates = graph.states.filter((state) => state.initial);
  for (const state of initialStates) {
    const node = { id: "@initial:" + (state.parent ?? ""), width: 10, height: 10 };
    if (state.parent) groups.get(state.parent)!.children!.push(node);
    else children.push(node);
  }
  const edges: ElkExtendedEdge[] = graph.transitions.map((edge, i) => ({
    id: "edge-" + i,
    sources: [edge.source],
    targets: [edge.target ?? edge.source],
    labels: [
      {
        id: "label-" + i,
        text: transitionLabel(edge),
        width: measure(transitionLabel(edge)) + 24,
        height: 24,
        layoutOptions: { "elk.edgeLabels.placement": "CENTER" },
      },
    ],
  }));
  for (const state of initialStates)
    edges.push({
      id: "@initial-edge:" + state.path,
      sources: ["@initial:" + (state.parent ?? "")],
      targets: [state.path],
    });
  let result: ElkNode;
  if (!layout)
    result = await new ELK().layout({
      id: "@root",
      children,
      edges,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.hierarchyHandling": "INCLUDE_CHILDREN",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.nodeNode": "48",
        "elk.layered.spacing.nodeNodeBetweenLayers": "64",
        "elk.spacing.edgeNode": "24",
        "elk.spacing.edgeEdge": "16",
        "elk.spacing.labelNode": "8",
      },
    });
  else {
    function place(rows: ElkNode[], parent?: string) {
      for (const node of rows) if (node.children) place(node.children, node.id);
      const positioned = rows.filter((node) => layout!.states[node.id]);
      let right = positioned.length
        ? Math.max(...positioned.map((node) => layout!.states[node.id]!.x + (node.width ?? 200))) +
          48
        : 24;
      const top = positioned.length
        ? Math.min(...positioned.map((node) => layout!.states[node.id]!.y))
        : parent
          ? 48
          : 24;
      for (const node of rows.filter((node) => !node.id.startsWith("@initial:"))) {
        const point = layout!.states[node.id];
        node.x = point?.x ?? right;
        node.y = point?.y ?? top;
        if (!point) right += (node.width ?? 200) + 48;
      }
      for (const node of rows.filter((node) => node.id.startsWith("@initial:"))) {
        const state = initialStates.find((state) => state.parent === parent);
        const child = rows.find((row) => row.id === state?.path);
        node.x = (child?.x ?? 48) - 32;
        node.y = (child?.y ?? 48) - 32;
      }
      if (parent) {
        const node = groups.get(parent)!;
        node.width = Math.max(
          200,
          ...rows.map((child) => (child.x ?? 0) + (child.width ?? 0) + 24),
        );
        node.height = Math.max(
          56,
          ...rows.map((child) => (child.y ?? 0) + (child.height ?? 0) + 24),
        );
      }
    }
    place(children);
    result = { id: "@root", children, edges };
  }
  const positions = new Map<string, ElkNode>();
  const routed = new Map<string, { edge: ElkExtendedEdge; offset: { x: number; y: number } }>();
  function visit(node: ElkNode, offset: { x: number; y: number }) {
    const next = { x: offset.x + (node.x ?? 0), y: offset.y + (node.y ?? 0) };
    positions.set(node.id, node);
    for (const edge of node.edges ?? []) routed.set(edge.id, { edge, offset: next });
    for (const child of node.children ?? []) visit(child, next);
  }
  visit(result, { x: 0, y: 0 });
  const nodes: CanvasNode[] = graph.states.map((state) => {
    const node = positions.get(state.path)!;
    return {
      id: state.path,
      type: "state",
      position: { x: node.x ?? 0, y: node.y ?? 0 },
      ...(state.parent ? { parentId: state.parent, extent: "parent" as const } : {}),
      style: { width: node.width ?? 200, height: node.height ?? 56 },
      data: { state },
    };
  });
  for (const state of initialStates) {
    const id = "@initial:" + (state.parent ?? "");
    const node = positions.get(id)!;
    nodes.push({
      id,
      type: "initial",
      position: { x: node.x ?? 0, y: node.y ?? 0 },
      ...(state.parent ? { parentId: state.parent } : {}),
      style: { width: 10, height: 10 },
      draggable: false,
      connectable: false,
      data: { state },
    });
  }
  const flowEdges: CanvasEdge[] = edges.map((input, i) => {
    const routing = routed.get(input.id);
    const edge = routing?.edge;
    const offset = routing?.offset ?? { x: 0, y: 0 };
    const sections = edge?.sections ?? [];
    const points = sections
      .flatMap((section) => [section.startPoint, ...(section.bendPoints ?? []), section.endPoint])
      .map((point) => ({ x: point.x + offset.x, y: point.y + offset.y }));
    const label = edge?.labels?.[0];
    return {
      id: input.id,
      source: input.sources[0]!,
      target: input.targets[0]!,
      type: "transition",
      label: i < graph.transitions.length ? transitionLabel(graph.transitions[i]!) : "",
      data: {
        ...(i < graph.transitions.length ? { transition: graph.transitions[i]! } : {}),
        ...(!layout && points.length ? { points } : {}),
        ...(!layout && label?.x !== undefined && label.y !== undefined
          ? {
              labelPosition: {
                x: label.x + offset.x + (label.width ?? 0) / 2,
                y: label.y + offset.y + (label.height ?? 0) / 2,
              },
            }
          : {}),
      },
    };
  });
  return { nodes, edges: flowEdges };
}
