// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MarkerType,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import {
  MousePointer2,
  Hand,
  Plus,
  Minus,
  Maximize,
  LayoutGrid,
  Undo2,
  Redo2,
  ArrowRight,
} from "lucide-react";
import { diff } from "@codemirror/merge";
import { parseDocument } from "yaml";
import { blueprintGraph } from "@wyrd-company/manifold-shared/blueprint-graph";
import type { ApiFinding, BlueprintGraph } from "@wyrd-company/manifold-shared/blueprints-api";
import { Button } from "../../ui/button.tsx";
import { layoutCanvas } from "./canvas-layout.ts";
import type { CanvasNode, CanvasEdge, BlueprintLayout } from "./canvas-layout.ts";
import { CanvasStateNode, InitialNode } from "./CanvasStateNode.tsx";
import { TransitionEdge } from "./TransitionEdge.tsx";
import { findingSelection } from "./problems.ts";
import { Inspector } from "./Inspector.tsx";
import { applyBlueprintEdit, atPointer, statePointer } from "./blueprint-edits.ts";
import type { BlueprintEdit, StateType } from "./blueprint-edits.ts";
import { recordEdit, undo, redo } from "./canvas-history.ts";
import type { CanvasHistory } from "./canvas-history.ts";
import "./canvas.css";
import "@xyflow/react/dist/style.css";
const nodeTypes = { state: CanvasStateNode, initial: InitialNode };
const edgeTypes = { transition: TransitionEdge };
interface Props {
  text: string;
  baseText: string;
  readOnly: boolean;
  findings: readonly ApiFinding[];
  warnings: readonly ApiFinding[];
  selection?: string | undefined;
  onSelect: (selection: string | undefined) => void;
  onChange: (basis: string, text: string) => void;
  onOpenYaml: () => void;
  blueprintPaths?: readonly string[];
}
export function BlueprintCanvasEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
function Canvas({
  text,
  baseText,
  readOnly,
  findings,
  warnings,
  selection,
  onSelect,
  onChange,
  onOpenYaml,
  blueprintPaths,
}: Props) {
  const changedRanges = useMemo(() => diff(baseText, text), [baseText, text]);
  const graph = useMemo(() => blueprintGraph(text), [text]);
  const [lastGraph, setLastGraph] = useState<BlueprintGraph | undefined>(graph);
  const [lastText, setLastText] = useState(text);
  const [layout, setLayout] = useState<{ nodes: CanvasNode[]; edges: CanvasEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [error, setError] = useState<string>();
  const [tool, setTool] = useState<"select" | "move" | "transition">("select");
  const [space, setSpace] = useState(false);
  const [placing, setPlacing] = useState<StateType>();
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number }>();
  const [connect, setConnect] = useState<{ source: string; target: string; basis: string }>();
  const [connectionSource, setConnectionSource] = useState<string>();
  const [event, setEvent] = useState("");
  const [trigger, setTrigger] = useState<"event" | "always" | "after" | "done" | "error">("event");
  const [showInspector, setShowInspector] = useState(true);
  const history = useRef<CanvasHistory>({ undo: [], redo: [] });
  const expected = useRef(text);
  const basis = useRef(text);
  const connecting = useRef<{ source: string; basis: string } | undefined>(undefined);
  const dragStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const flow = useReactFlow<CanvasNode, CanvasEdge>();
  const locked = readOnly || !graph;
  const doc = useMemo(() => parseDocument(text).toJS() as unknown, [text]);
  const pinned = atPointer(doc, "/layout") as BlueprintLayout | undefined;
  useEffect(() => {
    if (expected.current !== text) history.current = { undo: [], redo: [] };
    expected.current = text;
    if (!graph) return;
    let active = true;
    void layoutCanvas(graph, pinned, (label) => {
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return label.length * 8;
      context.font =
        "12px " + getComputedStyle(document.documentElement).getPropertyValue("--font-mono");
      return context.measureText(label).width;
    })
      .then((result) => {
        if (active) {
          setLayout(result);
          setLastGraph(graph);
          setLastText(text);
          setError(undefined);
        }
      })
      .catch(() => {
        if (active) setError("Cannot lay out this graph.");
      });
    return () => {
      active = false;
    };
  }, [graph, pinned, text]);
  function commit(edit: BlueprintEdit, editBasis = text) {
    if (locked) return;
    if (editBasis !== text) {
      setError("The draft changed during this edit.");
      return;
    }
    const result = applyBlueprintEdit(text, edit, graph);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    history.current = recordEdit(history.current, text, result.text);
    expected.current = result.text;
    onChange(text, result.text);
    if (result.select !== undefined) onSelect(result.select);
    setError(undefined);
  }
  const select = (value: string | undefined) => {
    onSelect(value);
    setShowInspector(true);
  };
  const runHistory = (direction: "undo" | "redo") => {
    if (locked) return;
    const result = (direction === "undo" ? undo : redo)(history.current, text);
    history.current = result.history;
    expected.current = result.text;
    onChange(text, result.text);
  };
  const remove = () => {
    if (selection && !selection.startsWith("@initial:"))
      commit(
        selection.startsWith("/")
          ? { kind: "remove-transition", pointer: selection }
          : { kind: "remove-state", path: selection },
      );
  };
  const openConnection = (source: string, target: string, editBasis = text) => {
    if (locked) return;
    setConnect({ source, target, basis: editBasis });
    setEvent("");
    setTrigger("event");
    setTool("select");
    setConnectionSource(undefined);
  };
  const placeAt = (screen: { x: number; y: number }) => {
    if (!placing || locked) return;
    const point = flow.screenToFlowPosition(screen);
    const groups = flow
      .getNodes()
      .filter((row) => ["compound", "parallel"].includes(row.data.state.type))
      .filter((row) => {
        const p = flow.getInternalNode(row.id)?.internals.positionAbsolute ?? row.position;
        return (
          point.x >= p.x &&
          point.y >= p.y &&
          point.x <= p.x + Number(row.style?.width) &&
          point.y <= p.y + Number(row.style?.height)
        );
      })
      .sort((a, b) => b.id.split(".").length - a.id.split(".").length);
    const parent = groups[0];
    const offset = parent
      ? (flow.getInternalNode(parent.id)?.internals.positionAbsolute ?? parent.position)
      : { x: 0, y: 0 };
    commit({
      kind: "add-state",
      parent: parent?.id ?? "",
      type: placing,
      position: {
        x: Math.round((point.x - offset.x) / 8) * 8,
        y: Math.round((point.y - offset.y) / 8) * 8,
      },
    });
    setPlacing(undefined);
  };
  const displayed = graph ?? lastGraph;
  const problem = (pointer: string) =>
    findings.some((f) => f.location === pointer || f.location.startsWith(pointer + "/"))
      ? ("error" as const)
      : warnings.some((f) => f.location === pointer || f.location.startsWith(pointer + "/"))
        ? ("warning" as const)
        : undefined;
  const pan = tool === "move" || space;
  return (
    <div className="canvas-editor">
      <section
        className={`canvas-surface ${!graph ? "stale" : ""}`}
        tabIndex={0}
        aria-label="Blueprint canvas"
        onKeyDown={(e) => {
          if (
            e.target instanceof HTMLElement &&
            e.target.closest("input,textarea,select,.cm-editor,.canvas-inspector")
          )
            return;
          if (e.key === " ") {
            e.preventDefault();
            setSpace(true);
          } else if (e.key === "Escape") {
            setPlacing(undefined);
            setConnect(undefined);
            setConnectionSource(undefined);
            setTool("select");
            setShowInspector(false);
          } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
            e.preventDefault();
            runHistory(e.shiftKey ? "redo" : "undo");
          } else if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            remove();
          } else if (e.key.toLowerCase() === "v") setTool("select");
          else if (e.key.toLowerCase() === "h") setTool("move");
          else if (!locked && e.key.toLowerCase() === "s") setPlacing("atomic");
          else if (!locked && e.key.toLowerCase() === "t") setTool("transition");
          else if (e.key === "+" || e.key === "=") void flow.zoomIn();
          else if (e.key === "-") void flow.zoomOut();
          else if (e.shiftKey && e.key === "1") void flow.fitView({ padding: 0.15 });
          else if (e.shiftKey && e.key.toLowerCase() === "l" && pinned)
            commit({ kind: "clear-layout" });
        }}
        onKeyUp={(e) => {
          if (e.key === " ") setSpace(false);
        }}
        onBlur={() => setSpace(false)}
        onMouseMove={(event) => {
          if (!placing) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setPointerPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
        onMouseLeave={() => setPointerPosition(undefined)}
      >
        <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Select"
            title="Select (V)"
            aria-pressed={tool === "select"}
            onClick={() => {
              setTool("select");
              setPlacing(undefined);
            }}
          >
            <MousePointer2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Move"
            title="Move (H)"
            aria-pressed={tool === "move"}
            onClick={() => {
              setTool("move");
              setPlacing(undefined);
            }}
          >
            <Hand />
          </Button>
          <span className="canvas-toolbar-separator" />
          <label className="canvas-add">
            <Plus size={16} />
            <select
              aria-label="Add state"
              disabled={locked}
              value={placing ?? ""}
              onChange={(e) => {
                setPlacing(e.target.value as StateType);
                setTool("select");
              }}
            >
              <option value="">Add state</option>
              <option value="atomic">State</option>
              <option value="compound">Compound state</option>
              <option value="parallel">Parallel state</option>
              <option value="final">Final state</option>
              <option value="history">History state</option>
            </select>
          </label>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Add transition"
            title="Add transition (T)"
            disabled={locked}
            aria-pressed={tool === "transition"}
            onClick={() => {
              setTool("transition");
              setPlacing(undefined);
              setConnectionSource(undefined);
            }}
          >
            <ArrowRight />
          </Button>
          <span className="canvas-toolbar-separator" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Undo"
            disabled={locked}
            onClick={() => runHistory("undo")}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Redo"
            disabled={locked}
            onClick={() => runHistory("redo")}
          >
            <Redo2 />
          </Button>
          <span className="canvas-toolbar-separator" />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom out"
            onClick={() => {
              void flow.zoomOut();
            }}
          >
            <Minus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zoom in"
            onClick={() => {
              void flow.zoomIn();
            }}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Fit"
            onClick={() => {
              void flow.fitView({ padding: 0.15 });
            }}
          >
            <Maximize />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Automatic layout"
            title={pinned ? "Automatic layout (Shift+L)" : "Layout is automatic"}
            disabled={locked || !pinned}
            onClick={() => commit({ kind: "clear-layout" })}
          >
            <LayoutGrid />
          </Button>
        </div>
        {error ? (
          <p className="canvas-message error-text" role="alert">
            {error}
          </p>
        ) : !graph ? (
          <p className="canvas-message">
            The canvas cannot draw this text. Fix it in the YAML view.{" "}
            <Button variant="ghost" onClick={onOpenYaml}>
              Open YAML
            </Button>
          </p>
        ) : placing ? (
          <p className="canvas-message">Click to place a {placing} state. Escape cancels.</p>
        ) : tool === "transition" ? (
          <p className="canvas-message">
            {connectionSource ? "Choose the target state." : "Choose the source state."}
          </p>
        ) : null}
        <ReactFlow<CanvasNode, CanvasEdge>
          nodes={layout.nodes.map((node) => ({
            ...node,
            selected: node.id === selection,
            data: {
              ...node.data,
              history:
                atPointer(doc, statePointer(node.data.state.path) + "/history") === "deep"
                  ? "deep"
                  : "shallow",
              problem: findings.some((f) => displayed && findingSelection(f, displayed) === node.id)
                ? "error"
                : warnings.some((f) => displayed && findingSelection(f, displayed) === node.id)
                  ? "warning"
                  : undefined,
              changed:
                !!node.data.state.range &&
                changedRanges.some(
                  (change) =>
                    change.fromB <= node.data.state.range!.to &&
                    change.toB >= node.data.state.range!.from,
                ),
            },
            ...(node.parentId &&
            layout.nodes.find((parent) => parent.id === node.parentId)?.data.state.type ===
              "parallel"
              ? { className: "parallel-region" }
              : {}),
          }))}
          edges={layout.edges.map((edge) => ({
            ...edge,
            selected:
              edge.data?.transition?.location === selection ||
              edge.source === selection ||
              edge.target === selection,
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--edge)" },
            data: {
              ...edge.data,
              problem: edge.data?.transition ? problem(edge.data.transition.location) : undefined,
            },
          }))}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={!locked && !pan && !placing}
          nodesConnectable={!locked && !pan && !placing}
          elementsSelectable={!pan}
          panOnDrag={pan ? true : [0, 1, 2]}
          minZoom={0.25}
          maxZoom={2}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          onNodesChange={(changes) =>
            setLayout((old) => ({ ...old, nodes: applyNodeChanges(changes, old.nodes) }))
          }
          onNodeDragStart={(_, node) => {
            basis.current = text;
            dragStart.current = node.position;
          }}
          onNodeDragStop={(_, node) => {
            const original = dragStart.current;
            if (original?.x === node.position.x && original.y === node.position.y) return;
            const states = Object.fromEntries(
              flow
                .getNodes()
                .filter((row) => row.type !== "initial")
                .map((row) => [
                  row.id,
                  { x: Math.round(row.position.x / 8) * 8, y: Math.round(row.position.y / 8) * 8 },
                ]),
            );
            commit({ kind: "set-layout", states }, basis.current);
          }}
          onConnectStart={(_, params) => {
            basis.current = text;
            if (params.nodeId) connecting.current = { source: params.nodeId, basis: text };
          }}
          onConnect={(connection) => {
            if (connection.source && connection.target) {
              openConnection(connection.source, connection.target, basis.current);
              connecting.current = undefined;
            }
          }}
          onConnectEnd={(event) => {
            const pending = connecting.current;
            connecting.current = undefined;
            if (!pending) return;
            const pointer = "changedTouches" in event ? event.changedTouches[0] : event;
            if (!pointer) return;
            const target = document
              .elementFromPoint(pointer.clientX, pointer.clientY)
              ?.closest(".react-flow__node")
              ?.getAttribute("data-id");
            if (target && !target.startsWith("@initial:"))
              openConnection(pending.source, target, pending.basis);
          }}
          onNodeClick={(event, node) => {
            if (placing) {
              placeAt({ x: event.clientX, y: event.clientY });
              return;
            }
            if (pan) return;
            if (tool === "transition" && !node.id.startsWith("@initial:")) {
              if (connectionSource) openConnection(connectionSource, node.id);
              else setConnectionSource(node.id);
            } else select(node.id);
          }}
          onEdgeClick={(_, edge) => {
            if (edge.data?.transition) select(edge.data.transition.location);
          }}
          onPaneClick={(e) => {
            if (!placing) {
              select(undefined);
              return;
            }
            if (locked) return;
            placeAt({ x: e.clientX, y: e.clientY });
          }}
        >
          <Background color="var(--grid)" gap={16} />
        </ReactFlow>
        {placing && pointerPosition && !locked ? (
          <div
            className={`canvas-placement-ghost ${placing}`}
            style={{ left: pointerPosition.x, top: pointerPosition.y }}
            aria-hidden="true"
          >
            {placing}
          </div>
        ) : null}
        {connect ? (
          <div className="canvas-event-picker">
            <h3>New transition</h3>
            <p className="mono">
              {connect.source} → {connect.target}
            </p>
            <label>
              Target
              <select
                aria-label="New target"
                value={connect.target}
                onChange={(event) => setConnect({ ...connect, target: event.target.value })}
              >
                {graph?.states.map((state) => (
                  <option key={state.path} value={state.path}>
                    {state.path}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trigger
              <select
                aria-label="Transition trigger"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value as typeof trigger)}
              >
                <option value="event">Event</option>
                <option value="always">always</option>
                <option value="after">after</option>
                <option value="done">done</option>
                <option value="error">error</option>
              </select>
            </label>
            <label>
              Event or delay
              <input
                aria-label="New event"
                className="mono"
                value={event}
                autoFocus
                list="blueprint-events"
                onChange={(e) => setEvent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commit(
                      {
                        kind: "add-transition",
                        source: connect.source,
                        target: connect.target,
                        trigger,
                        event,
                      },
                      connect.basis,
                    );
                    setConnect(undefined);
                  }
                }}
              />
            </label>
            <datalist id="blueprint-events">
              {Object.keys((atPointer(doc, "/schemas/events") ?? {}) as object).map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <Button
              disabled={locked || ((trigger === "event" || trigger === "after") && !event)}
              onClick={() => {
                commit(
                  {
                    kind: "add-transition",
                    source: connect.source,
                    target: connect.target,
                    trigger,
                    event,
                  },
                  connect.basis,
                );
                setConnect(undefined);
              }}
            >
              Add transition
            </Button>
            <Button variant="ghost" onClick={() => setConnect(undefined)}>
              Cancel
            </Button>
          </div>
        ) : null}
      </section>
      {displayed && showInspector ? (
        <Inspector
          key={selection ?? "root"}
          text={graph ? text : lastText}
          selection={selection}
          graph={displayed}
          findings={[
            ...findings.map((f) => ({ ...f, severity: "error" as const })),
            ...warnings.map((f) => ({ ...f, severity: "warning" as const })),
          ]}
          disabled={locked}
          onAddTransition={(source) =>
            openConnection(
              source,
              graph?.states.find((state) => state.path !== source)?.path ?? source,
            )
          }
          onEdit={commit}
          onSelect={select}
          onClose={() => setShowInspector(false)}
          {...(blueprintPaths ? { blueprintPaths } : {})}
        />
      ) : null}
    </div>
  );
}
