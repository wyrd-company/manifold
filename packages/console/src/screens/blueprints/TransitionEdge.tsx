// ---
// relationships:
//   implements: operator-console
// ---
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react";
import type { EdgeProps } from "@xyflow/react";
import type { CanvasEdge } from "./canvas-layout.ts";
function roundedPath(points: { x: number; y: number }[]) {
  if (!points.length) return "";
  let path = `M ${points[0]!.x},${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]!,
      point = points[i]!,
      next = points[i + 1];
    if (!next) {
      path += ` L ${point.x},${point.y}`;
      continue;
    }
    const distanceA = Math.hypot(point.x - previous.x, point.y - previous.y),
      distanceB = Math.hypot(next.x - point.x, next.y - point.y);
    const radius = Math.min(6, distanceA / 2, distanceB / 2);
    if (!distanceA || !distanceB) continue;
    path += ` L ${point.x - ((point.x - previous.x) * radius) / distanceA},${point.y - ((point.y - previous.y) * radius) / distanceA} Q ${point.x},${point.y} ${point.x + ((next.x - point.x) * radius) / distanceB},${point.y + ((next.y - point.y) * radius) / distanceB}`;
  }
  return path;
}
export function TransitionEdge(props: EdgeProps<CanvasEdge>) {
  const [smooth, x, y] = getSmoothStepPath(props);
  const path = props.data?.points?.length ? roundedPath(props.data.points) : smooth;
  const label = props.data?.labelPosition ?? { x, y };
  const trigger = props.data?.transition?.trigger;
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        {...(props.markerEnd ? { markerEnd: props.markerEnd } : {})}
        style={{
          stroke: props.selected ? "var(--primary)" : "var(--edge)",
          strokeWidth: props.selected ? 2 : 1.5,
          strokeDasharray: trigger === "always" ? "6 4" : trigger === "after" ? "2 4" : undefined,
        }}
      />
      {props.label ? (
        <EdgeLabelRenderer>
          <div
            className={`canvas-edge-label mono nodrag nopan ${props.selected ? "selected" : ""} ${props.data?.problem ?? ""}`}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${label.x}px,${label.y}px)`,
              pointerEvents: "all",
            }}
          >
            {props.label}
            {props.data?.problem ? " !" : ""}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
