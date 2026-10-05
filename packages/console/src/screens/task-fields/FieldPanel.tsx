// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import type {
  TaskField,
  StorageKind,
  TaskFieldEdit,
} from "@wyrd-company/manifold-shared/declarations-api";
import type { ProjectSummary } from "../../api/projects.ts";
import { Button } from "../../ui/button.tsx";
import { fieldScope } from "./fields.ts";
function TextSetting({
  label,
  value,
  placeholder,
  disabled,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled: boolean;
  onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const commit = () => {
    if (text !== value) {
      onCommit(text);
      setText(value);
    }
  };
  return (
    <label>
      {label}
      <input
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </label>
  );
}
export function FieldPanel({
  field,
  kinds,
  project,
  disabled,
  onEdit,
}: {
  field: TaskField;
  kinds: readonly StorageKind[];
  project: ProjectSummary | undefined;
  disabled: boolean;
  onEdit: (edit: TaskFieldEdit) => void;
}) {
  const kind = kinds.find((k) => k.kind === (field.storage ?? "project-field"));
  const holds = kind?.types.some((t) => t === field.type);
  const set = (values: Extract<TaskFieldEdit, { kind: "set-field" }>["values"]) =>
    onEdit({ kind: "set-field", location: field.location, values });
  return (
    <section className="field-panel">
      <fieldset disabled={disabled}>
        <h3>Field settings</h3>
        <TextSetting
          key={`name:${field.name}`}
          label="Field name"
          value={field.name}
          disabled={disabled || field.lifecycle}
          onCommit={(name) => set({ name })}
        />
        <label>
          Stored as<span>Project field</span>
        </label>
        <p className={holds ? "success-text" : "error-text"}>
          {holds ? "Can hold" : "Cannot hold"} {field.type}
        </p>
        {kind?.settings.map((setting) => (
          <TextSetting
            key={`${setting}:${field.settings?.[setting] ?? ""}`}
            label={setting === "name" ? "Project field name" : setting}
            value={field.settings?.[setting] ?? ""}
            placeholder={field.name}
            disabled={disabled || field.lifecycle}
            onCommit={(v) => set({ settings: { ...field.settings, [setting]: v } })}
          />
        ))}
        {field.type === "single-select" ? (
          <div className="field-options">
            <h4>Options</h4>
            {field.options?.map((option, index) => (
              <div key={option}>
                <TextSetting
                  label={`Option ${index + 1}`}
                  value={option}
                  disabled={disabled}
                  onCommit={(v) =>
                    set({ options: field.options!.map((o, i) => (i === index ? v : o)) })
                  }
                />
                <Button
                  aria-label={`Remove option ${index + 1}`}
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => set({ options: field.options!.filter((_, i) => i !== index) })}
                >
                  ×
                </Button>
              </div>
            ))}
            <Button
              variant="ghost"
              disabled={disabled}
              onClick={() =>
                set({
                  options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`],
                })
              }
            >
              Add option
            </Button>
          </div>
        ) : null}
        <div className="field-github">
          <h4>
            {field.onGitHub?.state === "present"
              ? "On GitHub"
              : field.onGitHub?.state === "missing"
                ? "Missing on GitHub"
                : field.onGitHub?.state === "differs"
                  ? "Differs on GitHub"
                  : "Not read from GitHub yet"}
          </h4>
          {field.onGitHub ? <p className="muted">{field.onGitHub.detail}</p> : null}
          <p className="mono muted">{fieldScope(field, project)}</p>
        </div>
        {!field.lifecycle ? (
          <>
            <h4>When changed on GitHub</h4>
            <div className="field-segment" role="group" aria-label="When changed on GitHub">
              {(["revert", "accept"] as const).map((v) => (
                <Button
                  variant={(field.whenChanged ?? "revert") === v ? "default" : "outline"}
                  key={v}
                  disabled={disabled}
                  aria-pressed={(field.whenChanged ?? "revert") === v}
                  onClick={() => set({ whenChanged: v })}
                >
                  {v === "revert" ? "Revert" : "Accept"}
                </Button>
              ))}
            </div>
          </>
        ) : null}
      </fieldset>
    </section>
  );
}
