// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useState } from "react";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import type { BlueprintGraph, ApiFinding } from "@wyrd-company/manifold-shared/blueprints-api";
import "@xyflow/react/dist/style.css";
import { layoutGraph } from "./graph-layout.ts";
import type { StateFlowNode } from "./graph-layout.ts";
import { StateNode } from "./StateNode.tsx";
import { findingState } from "./problems.ts";
const nodeTypes = { state: StateNode };
export function GraphPane({
  graph,
  findings,
  warnings,
  selected,
  onSelect,
}: {
  graph?: BlueprintGraph | undefined;
  findings: readonly ApiFinding[];
  warnings: readonly ApiFinding[];
  selected?: string | undefined;
  onSelect: (path: string) => void;
}) {
  const [layout, setLayout] = useState<{ nodes: StateFlowNode[]; edges: Edge[] }>({
    nodes: [],
    edges: [],
  });
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!graph) return;
    let current = true;
    void layoutGraph(graph)
      .then((result) => {
        if (current) {
          setLayout(result);
          setError(undefined);
        }
      })
      .catch(() => {
        if (current) setError("Cannot lay out this graph.");
      });
    return () => {
      current = false;
    };
  }, [graph]);
  const states = layout.nodes.map((node) => node.data.state);
  return (
    <section className={`blueprint-graph ${!graph ? "stale" : ""}`}>
      <div className="blueprint-pane-toolbar">
        Graph {!graph ? <span className="muted">Showing the last text that parsed.</span> : null}
        {error ? <span role="alert">{error}</span> : null}
      </div>
      <ReactFlow
        nodes={layout.nodes.map((node) => ({
          ...node,
          selected: node.id === selected,
          data: {
            ...node.data,
            problem: findings.some((f) => findingState(f, states) === node.id)
              ? "error"
              : warnings.some((f) => findingState(f, states) === node.id)
                ? "warning"
                : undefined,
          },
        }))}
        edges={layout.edges.map((edge) => ({
          ...edge,
          style: {
            stroke:
              edge.source === selected || edge.target === selected
                ? "var(--primary)"
                : "var(--edge)",
            strokeWidth: 1.5,
          },
        }))}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeClick={(_, node) => onSelect(node.id)}
        fitView
      >
        <Background color="var(--grid)" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </section>
  );
}
