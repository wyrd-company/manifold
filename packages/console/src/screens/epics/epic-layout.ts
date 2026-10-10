// ---
// relationships:
//   implements: operator-console
// ---
import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api.js";
import type { EpicGraph } from "./epic-graph.ts";
export async function layoutEpic(graph: EpicGraph) {
  const result: ElkNode = await new ELK().layout({
    id: "epic",
    children: graph.nodes.map((id) => ({
      id,
      width: 152,
      height: 84,
      ports: [
        { id: id + ":in", layoutOptions: { "elk.port.side": "WEST" } },
        { id: id + ":out", layoutOptions: { "elk.port.side": "EAST" } },
      ],
      layoutOptions: { "elk.portConstraints": "FIXED_SIDE" },
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      sources: [e.blocking + ":out"],
      targets: [e.blocked + ":in"],
    })),
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.spacing.nodeNode": "40",
      "elk.layered.spacing.nodeNodeBetweenLayers": "64",
    },
  });
  return {
    nodes: result.children!.map((n) => ({ id: n.id, position: { x: n.x!, y: n.y! } })),
    edges: result.edges!.map((e) => ({
      id: e.id,
      points: e.sections!.flatMap((s) => [s.startPoint, ...(s.bendPoints ?? []), s.endPoint]),
    })),
  };
}
