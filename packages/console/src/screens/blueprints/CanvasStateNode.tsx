// ---
// relationships:
//   implements: operator-console
// ---
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { CanvasNode } from "./canvas-layout.ts";
export function CanvasStateNode({ data, selected }: NodeProps<CanvasNode>) {
  const state = data.state;
  return (
    <div className={`canvas-state ${state.type} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="canvas-state-title">
        <span className="mono">
          {state.type === "history" ? (data.history === "deep" ? "H*" : "H") : state.key}
        </span>
        {state.type === "parallel" ? <small className="muted">Parallel</small> : null}
        {data.changed ? <i className="canvas-changed" /> : null}
        {data.problem ? <span className={`blueprint-problem ${data.problem}`}>!</span> : null}
      </div>
      {state.invokes[0] ? (
        <small className="mono muted">
          {state.invokes[0]}
          {state.invokes.length > 1 ? " +" + (state.invokes.length - 1) : ""}
        </small>
      ) : null}
      {state.gated ? <span className="blueprint-gate">Gate</span> : null}
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
