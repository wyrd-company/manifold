// ---
// relationships:
//   implements: operator-console
// ---
import type { ProjectSummary } from "../../api/projects.ts";
export function ConfigurationBadge({
  configuration,
}: {
  configuration: ProjectSummary["configuration"];
}) {
  const { state } = configuration;
  return (
    <span
      className={`configuration-badge ${state === "drift" ? "warning" : state === "in-sync" ? "success" : "info"}`}
    >
      {state === "in-sync"
        ? "In sync"
        : state === "not-applied"
          ? "Not applied"
          : `${state === "drift" ? "Drift" : "Pending"} · ${"count" in configuration ? configuration.count : 0}`}
    </span>
  );
}
