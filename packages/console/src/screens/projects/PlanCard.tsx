// ---
// relationships:
//   implements: operator-console
// ---
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
      {groups.length === 0 ? (
        <p className="muted">Nothing to apply. The Project matches the task fields.</p>
      ) : (
        groups.map((group) => (
          <div key={group.storage}>
            <div className="plan-group-heading">
              <strong>Project fields</strong>
              <span className="mono muted">
                On {plan.owner}/{plan.number}
              </span>
              <span>
                {group.creates} to create · {group.changes} to change · {group.removes} to remove
              </span>
            </div>
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
