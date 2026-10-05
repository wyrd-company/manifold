// ---
// relationships:
//   implements: operator-console
// ---
import { Lock, Trash2 } from "lucide-react";
import type {
  TaskField,
  StorageKind,
  TaskFieldEdit,
  DeclarationFinding,
  TaskFieldType,
} from "@wyrd-company/manifold-shared/declarations-api";
import type { ProjectSummary } from "../../api/projects.ts";
import { Button } from "../../ui/button.tsx";
import { fieldGroups, rowFindings } from "./fields.ts";
export function FieldsTable({
  fields,
  storageKinds,
  projects,
  findings,
  selected,
  disabled,
  onSelect,
  onEdit,
}: {
  fields: readonly TaskField[];
  storageKinds: readonly StorageKind[];
  projects: readonly ProjectSummary[];
  findings: readonly DeclarationFinding[];
  selected: string | undefined;
  disabled: boolean;
  onSelect: (f: TaskField) => void;
  onEdit: (edit: TaskFieldEdit) => void;
}) {
  const errors = rowFindings(fields, findings);
  const groups = fieldGroups(fields, projects);
  return (
    <div className="fields-table">
      {groups.length === 0 ? (
        <div className="projects-empty">
          <h3>No task fields</h3>
          <p className="muted">Declare a bound Project in task-metadata.yml to add its fields.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.binding}>
            <div className="field-group-heading">
              <span className="mono">
                {group.binding}{" "}
                {group.project ? `· ${group.project.owner}/${group.project.number}` : ""}
              </span>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => onEdit({ kind: "add-field", binding: group.binding })}
              >
                Add field
              </Button>
            </div>
            <table className="projects-table">
              <colgroup>
                {[40, 26, 26, 8].map((width, i) => (
                  <col
                    key={["field", "type", "storage", "action"][i]}
                    style={{ width: `${width}%` }}
                  />
                ))}
              </colgroup>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Stored as</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {group.fields.map((field) => {
                  const error = errors.get(field.location);
                  const kind = storageKinds.find(
                    (k) => k.kind === (field.storage ?? "project-field"),
                  );
                  const types = [...new Set([field.type ?? "", ...(kind?.types ?? [])])];
                  return (
                    <tr
                      key={field.location}
                      className={selected === field.location ? "selected" : ""}
                    >
                      <td>
                        <button
                          disabled={disabled}
                          className="field-select"
                          onClick={() => onSelect(field)}
                        >
                          {field.name}
                          {field.lifecycle ? <Lock size={14} aria-label="Set by Manifold" /> : null}
                          {error?.error ? <span className="error-text">!</span> : null}
                        </button>
                      </td>
                      <td>
                        <select
                          aria-label={`Type of ${field.name}`}
                          value={field.type ?? ""}
                          disabled={disabled || field.lifecycle}
                          className={error?.typeOrStorage ? "field-error" : ""}
                          onChange={(e) =>
                            onEdit({
                              kind: "set-field",
                              location: field.location,
                              values: { type: e.target.value as TaskFieldType },
                            })
                          }
                        >
                          {types.map((type) => (
                            <option key={type} value={type}>
                              {type || "Choose type"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Storage of ${field.name}`}
                          value={field.storage ?? "project-field"}
                          disabled={disabled || field.lifecycle}
                          className={error?.typeOrStorage ? "field-error" : ""}
                          onChange={() =>
                            onEdit({
                              kind: "set-field",
                              location: field.location,
                              values: { storage: "project-field" },
                            })
                          }
                        >
                          {field.storage && field.storage !== "project-field" ? (
                            <option>{field.storage}</option>
                          ) : null}
                          <option value="project-field">Project field</option>
                        </select>
                      </td>
                      <td>
                        {!field.lifecycle ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            aria-label="Remove field"
                            onClick={() =>
                              onEdit({ kind: "remove-field", location: field.location })
                            }
                          >
                            <Trash2 size={14} />
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
