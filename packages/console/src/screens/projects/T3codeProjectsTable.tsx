// ---
// relationships:
//   implements: operator-console
// ---
import { Pencil } from "lucide-react";
import type { BindingsResponse } from "@wyrd-company/manifold-shared/declarations-api";
import { Button } from "../../ui/button.tsx";
import { t3codeRows } from "./rows.ts";
export function T3codeProjectsTable({
  bindings,
  onBind,
  onEdit,
}: {
  bindings: BindingsResponse;
  onBind: () => void;
  onEdit: (name: string) => void;
}) {
  const rows = t3codeRows(bindings);
  return (
    <section className="projects-section">
      <div className="projects-heading">
        <h2>T3code projects</h2>
        <Button variant="outline" onClick={onBind}>
          Bind a T3code project
        </Button>
      </div>
      {rows.length === 0 ? (
        <div className="projects-empty">
          <h3>No T3code projects bound</h3>
          <p className="muted">Bind a T3code project, or associate one with a bound Project.</p>
        </div>
      ) : (
        <table className="projects-table">
          <colgroup>
            {[34, 16, 30, 12, 8].map((width) => (
              <col key={width} style={{ width: `${width}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {["T3code project", "Environment", "Portfolio item", "Active threads", ""].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.name}:${row.id}`}>
                <td className="mono">
                  {row.title}
                  <small className="muted">
                    {row.workspaceRoot ?? (row.missing ? `Not found on ${row.environment}` : "")}
                  </small>
                </td>
                <td className="mono">{row.environment}</td>
                <td>
                  {row.itemTitle}
                  {row.associated ? (
                    <small className="muted">
                      Associated with <span className="mono">{row.associated}</span>
                    </small>
                  ) : null}
                </td>
                <td className="numeric">{row.activeThreads ?? "—"}</td>
                <td>
                  {row.associated ? null : (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${row.name}`}
                      onClick={() => onEdit(row.name)}
                    >
                      <Pencil size={16} />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
