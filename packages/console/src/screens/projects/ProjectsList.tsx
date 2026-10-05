// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { fetchProjects } from "../../api/projects.ts";
import { fetchBindings } from "../../api/declarations.ts";
import { fetchTasks } from "../../api/tasks.ts";
import { Button } from "../../ui/button.tsx";
import { projectRows } from "./rows.ts";
import { ConfigurationBadge } from "./ConfigurationBadge.tsx";
import { T3codeProjectsTable } from "./T3codeProjectsTable.tsx";
import { BindProjectDialog } from "./BindProjectDialog.tsx";
import { BindT3codeProjectDialog } from "./BindT3codeProjectDialog.tsx";
export function ProjectsList() {
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, retry: false });
  const bindings = useQuery({ queryKey: ["bindings"], queryFn: fetchBindings, retry: false });
  const tasks = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks, retry: false });
  const [bind, setBind] = useState(false);
  const [t3code, setT3code] = useState<string | undefined>();
  const b = bindings.data?.kind === "ok" ? bindings.data.body : undefined;
  const result = projects.data;
  const rows =
    result?.kind === "ok"
      ? projectRows(
          result.body.projects,
          tasks.data?.kind === "ok" ? tasks.data.projects : undefined,
          b,
        )
      : [];
  const refresh = () => {
    void projects.refetch();
    void bindings.refetch();
    void tasks.refetch();
  };
  return (
    <div className="projects-screen">
      <div className="projects-heading">
        <p className="muted">Keep each bound Project's fields in step with the task fields.</p>
        <div className="projects-actions">
          <Button variant="ghost" render={<Link to="/settings/task-fields" />}>
            Task fields
          </Button>
          <Button disabled={!b} onClick={() => setBind(true)}>
            Bind a Project
          </Button>
        </div>
      </div>
      <div className="projects-count">
        <span>{rows.length} Projects</span>
        <Button aria-label="Refresh Projects" variant="ghost" size="icon" onClick={refresh}>
          <RefreshCw size={16} />
        </Button>
      </div>
      {!result ? (
        <p role="status">Loading Projects…</p>
      ) : result.kind !== "ok" ? (
        <div className="error-alert" role="alert">
          {result.message}
          <Button onClick={refresh}>Try again</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="projects-empty">
          <h3>No bound Projects</h3>
          <p className="muted">
            Bind a GitHub Project to keep its fields in step with the task fields.
          </p>
        </div>
      ) : (
        <table className="projects-table">
          <colgroup>
            {[26, 16, 10, 10, 14, 12, 12].map((width, i) => (
              <col
                key={
                  [
                    "project",
                    "portfolio",
                    "active",
                    "completed",
                    "environment",
                    "configuration",
                    "action",
                  ][i]
                }
                style={{ width: `${width}%` }}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {[
                "Project",
                "Portfolio item",
                "Active cards",
                "Completed cards",
                "Environment",
                "Configuration",
                "",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.binding}>
                <td className="mono">
                  {row.owner}/{row.number}
                </td>
                <td>{row.itemTitle}</td>
                <td className="numeric">{row.active ?? "—"}</td>
                <td className="numeric">{row.completed ?? "—"}</td>
                <td className="mono">{row.environment}</td>
                <td>
                  <ConfigurationBadge configuration={row.configuration} />
                </td>
                <td>
                  <Button
                    variant="outline"
                    render={<Link to="/projects/$binding" params={{ binding: row.binding }} />}
                  >
                    {row.configuration.state === "in-sync" ? "View" : "Review changes"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {bindings.data?.kind === "failed" ? (
        <div role="alert" className="error-alert">
          {bindings.data.message}
          <Button
            onClick={() => {
              void bindings.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : null}
      {b ? (
        <>
          <T3codeProjectsTable bindings={b} onBind={() => setT3code("")} onEdit={setT3code} />
          {bind ? <BindProjectDialog bindings={b} onClose={() => setBind(false)} /> : null}
          {t3code !== undefined ? (
            <BindT3codeProjectDialog
              bindings={b}
              name={t3code}
              onClose={() => setT3code(undefined)}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
