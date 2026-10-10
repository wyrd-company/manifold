// ---
// relationships:
//   implements: operator-console
// ---
import { Link } from "@tanstack/react-router";
import { storageLabels } from "../task-fields/fields.ts";
import { Lock } from "lucide-react";
import type { ProjectPlanResponse } from "../../api/projects.ts";
import { changeTarget, planGroups } from "./plan.ts";
export function PlanCard({
  plan,
  removeUndeclared,
  onRemove,
  busy,
}: {
  plan: ProjectPlanResponse;
  removeUndeclared: boolean;
  onRemove: (value: boolean) => void;
  busy: boolean;
}) {
  const groups = planGroups(plan.changes, removeUndeclared).groups;
  return (
    <section className="project-card">
      <div className="project-card-heading">
        <h3>What Apply will change</h3>
        <label className="project-switch">
          <input
            type="checkbox"
            role="switch"
            checked={removeUndeclared}
            disabled={busy}
            onChange={(e) => onRemove(e.target.checked)}
          />
          Also remove what the task fields do not define
        </label>
      </div>
      {plan.observation.status === "stale" ? (
        <p className="warning-text" role="alert">
          Cannot read this Project from GitHub: {plan.observation.message}.
          {plan.observedAt !== null
            ? ` The plan uses what Manifold read ${new Date(plan.observedAt).toLocaleString()}.`
            : ""}
        </p>
      ) : null}
      {plan.scopes
        ?.filter((scope) => scope.status !== "ready")
        .map((scope) => (
          <p key={`${scope.scope.kind}:${scope.scope.name}`} className="warning-text" role="alert">
            {scope.scope.name}: {scope.status}
            {scope.message ? ` · ${scope.message}` : ""}
          </p>
        ))}
      {plan.outside?.length ? (
        <p className="muted">
          {plan.outside.map((row) => `${row.repository} (${row.issues} issues)`).join(", ")} outside
          the declared repositories. <Link to="/settings/task-fields">Edit repositories</Link>
        </p>
      ) : null}
      {plan.frontMatter && plan.frontMatter.mismatched > 0 ? (
        <p className="muted">
          {plan.frontMatter.mismatched} issues have front matter the task fields cannot read.
        </p>
      ) : null}
      {groups.length === 0 ? (
        <p className="muted">Nothing to apply. The Project matches the task fields.</p>
      ) : (
        groups.map((group) => (
          <div key={`${group.storage}:${group.scope?.kind}:${group.scope?.name}`}>
            <div className="plan-group-heading">
              <strong>{storageLabels[group.storage]}s</strong>
              <span className="mono muted">
                {group.scope ? group.scope.name : `On ${plan.owner}/${plan.number}`}
              </span>
              <span>
                {group.creates} to create · {group.changes} to change · {group.removes} to remove
              </span>
            </div>
            {group.scope && group.scope.bindings.length > 1 ? (
              <p className="muted">
                Also used by {group.scope.bindings.filter((b) => b !== plan.binding).join(", ")}
              </p>
            ) : null}
            {group.rows.map(({ change, kept }) => (
              <div className={`plan-row ${kept ? "kept" : ""}`} key={change.id}>
                <span
                  className={
                    change.action === "create"
                      ? "success-text"
                      : change.action === "remove"
                        ? "error-text"
                        : "warning-text"
                  }
                >
                  {change.action === "create" ? "+" : change.action === "remove" ? "−" : "~"}
                </span>
                <span className="mono">
                  {changeTarget(change)}{" "}
                  {change.target.lifecycle ? <Lock size={14} aria-label="Set by Manifold" /> : null}
                </span>
                <span>{change.description}</span>
                {change.drift ? <span className="configuration-badge warning">Drift</span> : null}
                {change.side === "declaration" ? (
                  <span className="configuration-badge info">Into task fields</span>
                ) : null}
                {kept ? <span className="configuration-badge">Kept</span> : null}
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  );
}
