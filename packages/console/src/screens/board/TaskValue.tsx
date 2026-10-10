// ---
// relationships:
//   implements: [operator-console, tasks-api]
// ---
import type { TaskFieldValue } from "@wyrd-company/manifold-shared";
export function TaskValue({
  value,
  singleSelect = false,
}: {
  value: TaskFieldValue;
  singleSelect?: boolean;
}) {
  if (value.state === "set")
    return singleSelect ? <span className="task-badge">{value.value}</span> : <>{value.value}</>;
  if (value.state === "empty") return <span className="muted">Empty</span>;
  return (
    <span className={value.state === "invalid" ? "warning-text" : "muted"} title={value.detail}>
      {value.state === "invalid" ? "Cannot read" : "Not available"}
    </span>
  );
}
