// ---
// relationships:
//   implements: operator-console
// ---
import { useState, useMemo } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
} from "@xyflow/react";
import type { Node, NodeProps, Edge, EdgeProps } from "@xyflow/react";
import { useQuery } from "@tanstack/react-query";
import type { Epic, EpicIssue } from "@wyrd-company/manifold-shared/epics-api";
import { epicEmphasis } from "./epic-graph.ts";
import type { EpicGraph, EmphasisState } from "./epic-graph.ts";
import { layoutEpic } from "./epic-layout.ts";
import "@xyflow/react/dist/style.css";
import "./epics.css";
type TaskFlowNode = Node<
  {
    issue: EpicIssue;
    opacity: number;
    selected: boolean;
    onSelect: () => void;
    onFocus: (active: boolean) => void;
  },
  "task"
>;
type TaskFlowEdge = Edge<{ points: { x: number; y: number }[] }, "dependency">;
function TaskNode({ data }: NodeProps<TaskFlowNode>) {
  const { issue, task } = data.issue,
    done = issue.state === "closed",
    reference = `${issue.repository}#${issue.number}`;
  return (
    <div
      className={`epic-node ${data.issue.placement === "outside" ? "outside" : ""} ${data.selected ? "selected" : ""}`}
      style={{ opacity: data.opacity }}
    >
      <Handle type="target" position={Position.Left} />
      <button
        className="nodrag nopan"
        onClick={(event) => {
          event.stopPropagation();
          data.onSelect();
        }}
        onFocus={() => data.onFocus(true)}
        onBlur={() => data.onFocus(false)}
        aria-label={reference + " " + (issue.title ?? "")}
        aria-pressed={data.selected}
      >
        <span className="epic-node-top">
          <span
            aria-label={done ? "Done" : task?.actor ? "Actor" : "No actor"}
            className={done ? "epic-done" : `status-dot ${task?.actor?.status ?? "hollow"}`}
          >
            {done ? "✓" : null}
          </span>
          <span className="mono">{reference}</span>
          {task?.openEscalations ? (
            <span className="epic-badge warning-text">Escalated</span>
          ) : task?.actor?.status === "held" ? (
            <span className="epic-badge error-text">Failed</span>
          ) : null}
        </span>
        <span className={`epic-node-title ${done || !issue.title ? "muted" : ""}`}>
          {issue.title ?? reference}
        </span>
        <span className="epic-node-lifecycle muted">
          {data.issue.placement === "outside" ? "Outside this epic · " : ""}
          {task ? (task.projects[0]!.status ?? "No status") : "Not on a bound Project"}
          {task?.actor?.states[0] ? <span className="mono"> · {task.actor.states[0]}</span> : null}
        </span>
      </button>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
function roundedPath(points: { x: number; y: number }[]) {
  let path = `M ${points[0]!.x},${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!,
      b = points[i]!,
      c = points[i + 1];
    if (!c) {
      path += ` L ${b.x},${b.y}`;
      continue;
    }
    const da = Math.hypot(b.x - a.x, b.y - a.y),
      db = Math.hypot(c.x - b.x, c.y - b.y),
      r = Math.min(6, da / 2, db / 2);
    if (!da || !db) continue;
    path += ` L ${b.x - ((b.x - a.x) * r) / da},${b.y - ((b.y - a.y) * r) / da} Q ${b.x},${b.y} ${b.x + ((c.x - b.x) * r) / db},${b.y + ((c.y - b.y) * r) / db}`;
  }
  return path;
}
function DependencyEdge(props: EdgeProps<TaskFlowEdge>) {
  return (
    <BaseEdge
      id={props.id}
      path={roundedPath(props.data!.points)}
      {...(props.markerEnd ? { markerEnd: props.markerEnd } : {})}
      {...(props.style ? { style: props.style } : {})}
    />
  );
}
const nodeTypes = { task: TaskNode },
  edgeTypes = { dependency: DependencyEdge };
export function EpicGraphView({
  epic,
  graph,
  state,
  onSelect,
}: {
  epic: Epic;
  graph: EpicGraph;
  state: EmphasisState;
  onSelect: (id?: string) => void;
}) {
  const [hovered, setHovered] = useState<string>();
  const [focused, setFocused] = useState<string>();
  const layoutQuery = useQuery({
    queryKey: ["epic-layout", graph.nodes, graph.edges.map((e) => [e.blocking, e.blocked])],
    queryFn: () => layoutEpic(graph),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const layout = layoutQuery.data;
  const focus = hovered ?? focused;
  const emphasis = epicEmphasis(graph, { ...state, ...(focus ? { hovered: focus } : {}) });
  const byId = useMemo(() => new Map(epic.issues.map((i) => [i.issue.nodeId, i])), [epic]);
  const nodes: TaskFlowNode[] =
    layout?.nodes.map((n) => ({
      ...n,
      type: "task",
      data: {
        issue: byId.get(n.id)!,
        opacity: emphasis.nodes.get(n.id)!,
        selected: state.selected === n.id,
        onSelect: () => onSelect(state.selected === n.id ? undefined : n.id),
        onFocus: (active) => setFocused(active ? n.id : undefined),
      },
      draggable: false,
      connectable: false,
      focusable: false,
      width: 152,
      height: 84,
      style: { width: 152, height: 84 },
    })) ?? [];
  const routes = new Map(layout?.edges.map((e) => [e.id, e.points]));
  const edges: TaskFlowEdge[] = graph.edges.map((e) => {
    const critical = emphasis.critical.has(e.id),
      color = e.cyclic ? "var(--error-foreground)" : critical ? "var(--primary)" : "var(--edge)";
    return {
      id: e.id,
      source: e.blocking,
      target: e.blocked,
      type: "dependency",
      className: `${critical ? "epic-critical" : ""} ${e.cyclic ? "epic-cyclic" : ""}`,
      data: { points: routes.get(e.id) ?? [] },
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: {
        stroke: color,
        strokeWidth: critical ? 2 : 1.5,
        strokeDasharray: e.cyclic ? "6 4" : undefined,
        opacity: emphasis.edges.get(e.id),
        transition: "opacity 150ms",
      },
      focusable: false,
    };
  });
  if (layoutQuery.isError)
    return <div role="alert">Cannot lay out this epic. Refresh to try again.</div>;
  if (!layout) return <p role="status">Laying out tasks…</p>;
  return (
    <div className="epic-canvas">
      <ReactFlow
        key={epic.root}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        minZoom={0.2}
        maxZoom={2}
        onNodeMouseEnter={(_event, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(undefined)}
        onPaneClick={() => onSelect()}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <Panel position="bottom-right" className="epic-legend">
          <span>✓ Done</span>
          <span>● Actor</span>
          <span>○ No actor</span>
          <span className="outside">Outside</span>
          <span>→ Dependency</span>
          <span className="primary-text">→ Critical</span>
          <span className="error-text">⇢ Cyclic</span>
        </Panel>
      </ReactFlow>
    </div>
  );
}
