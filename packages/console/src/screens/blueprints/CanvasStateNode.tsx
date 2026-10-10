// ---
// relationships:
//   implements: operator-console
// ---
import { Handle, Position } from "@xyflow/react";
import { Circle, CircleCheckBig, Columns2, FileCode2, SquareStack, Zap } from "lucide-react";
import type { NodeProps } from "@xyflow/react";
import type { CanvasNode } from "./canvas-layout.ts";
export function CanvasStateNode({ data, selected }: NodeProps<CanvasNode>) {
  const state = data.state;
  const Icon =
    state.type === "final"
      ? CircleCheckBig
      : state.type === "parallel"
        ? Columns2
        : state.type === "compound"
          ? SquareStack
          : state.invokes[0]?.endsWith(".yml")
            ? FileCode2
            : state.invokes.length
              ? Zap
              : Circle;
  return (
    <div
      className={`canvas-state ${state.type} ${selected ? "selected" : ""}`}
      data-depth={state.path.split(".").length % 2}
      title={state.path}
    >
      <Handle type="target" position={Position.Top} />
      <div className="canvas-state-title">
        {state.type !== "history" ? (
          <span className="canvas-state-icon">
            <Icon size={15} />
          </span>
        ) : null}
        <span className="mono">
          {state.type === "history" ? (data.history === "deep" ? "H*" : "H") : state.key}
        </span>
        {state.type === "parallel" ? <small className="muted">Parallel</small> : null}
        {data.changed ? <i className="canvas-changed" /> : null}
        {data.problem ? <span className={`blueprint-problem ${data.problem}`}>!</span> : null}
      </div>
      {state.type === "history" ? (
        <small className="canvas-history-key mono muted">{state.key}</small>
      ) : null}
      {state.invokes.length || state.gated ? (
        <div className="canvas-state-detail">
          {state.invokes[0] ? (
            <small className="mono muted" title={state.invokes.join(", ")}>
              {state.invokes[0]}
              {state.invokes.length > 1 ? " +" + (state.invokes.length - 1) : ""}
            </small>
          ) : null}
          {state.gated ? <span className="blueprint-gate">Gate</span> : null}
        </div>
      ) : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
export function InitialNode() {
  return (
    <div className="canvas-initial">
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
