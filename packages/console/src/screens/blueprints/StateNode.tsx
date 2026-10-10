// ---
// relationships:
//   implements: operator-console
// ---
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { StateFlowNode } from "./graph-layout.ts";
export function StateNode({ data, selected }: NodeProps<StateFlowNode>) {
  const state = data.state;
  return (
    <div className={`blueprint-state ${state.type} ${selected ? "selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <span className="mono">
        {state.initial ? "● → " : ""}
        {state.key}
      </span>
      {data.problem ? <span className={`blueprint-problem ${data.problem}`}>!</span> : null}
      {state.gated ? <span className="blueprint-gate">Gate</span> : null}
      {state.invokes[0] ? <small className="mono muted">{state.invokes[0]}</small> : null}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
