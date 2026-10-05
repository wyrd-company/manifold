// ---
// relationships:
//   implements: operator-console
// ---
import type {
  TaskField,
  DeclarationFindings,
  TaskFieldEdit,
} from "@wyrd-company/manifold-shared/declarations-api";
import type { ProjectSummary } from "../../api/projects.ts";
import { FieldsTable } from "./FieldsTable.tsx";
import { FieldPanel } from "./FieldPanel.tsx";
export function SchemaEditor({
  fields,
  lint,
  projects,
  selected,
  disabled,
  onSelect,
  onEdit,
}: {
  fields: readonly TaskField[];
  lint: DeclarationFindings;
  projects: readonly ProjectSummary[];
  selected: string | undefined;
  disabled: boolean;
  onSelect: (f: TaskField) => void;
  onEdit: (edit: TaskFieldEdit) => void;
}) {
  const field = fields.find((f) => f.location === selected);
  return (
    <>
      <div className={`task-fields-visual ${lint.fields === undefined ? "dimmed" : ""}`}>
        <FieldsTable
          fields={fields}
          storageKinds={lint.storageKinds ?? []}
          projects={projects}
          findings={lint.findings}
          selected={selected}
          disabled={disabled}
          onSelect={onSelect}
          onEdit={onEdit}
        />
        {field ? (
          <FieldPanel
            key={field.location}
            field={field}
            kinds={lint.storageKinds ?? []}
            project={projects.find((p) => p.binding === field.binding)}
            disabled={disabled}
            onEdit={onEdit}
          />
        ) : (
          <div className="field-panel muted">Select a field to edit its settings.</div>
        )}
      </div>
      {lint.fields === undefined ? (
        <p className="muted">Fix the YAML to edit fields here.</p>
      ) : null}
    </>
  );
}
