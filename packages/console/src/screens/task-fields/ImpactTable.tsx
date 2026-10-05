// ---
// relationships:
//   implements: operator-console
// ---
import type { ProjectImpact } from "@wyrd-company/manifold-shared/declarations-api";
import type { ProjectSummary } from "../../api/projects.ts";
export function ImpactTable({
  impact,
  projects,
}: {
  impact: readonly ProjectImpact[];
  projects: readonly ProjectSummary[];
}) {
  return (
    <>
      <table className="projects-table impact-table">
        <thead>
          <tr>
            {["Project", "Creates", "Changes", "Removes", "After Publish"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {impact.map((row) => {
            const project = projects.find((p) => p.binding === row.binding);
            const count = (row.creates ?? 0) + (row.changes ?? 0);
            return (
              <tr key={row.binding}>
                <td className="mono">
                  {row.binding}
                  <small className="muted">
                    {project ? `${project.owner}/${project.number}` : ""}
                  </small>
                </td>
                <td className="numeric">{row.creates ?? "—"}</td>
                <td className="numeric">{row.changes ?? "—"}</td>
                <td className="numeric">{row.removes ?? "—"}</td>
                <td>
                  {row.creates === undefined
                    ? "Not read from GitHub yet"
                    : count
                      ? `Apply ${count} changes on its page`
                      : "Nothing to apply"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="muted">
        Publishing changes no Project. Removals happen only when an Apply asks for them.
      </p>
    </>
  );
}
