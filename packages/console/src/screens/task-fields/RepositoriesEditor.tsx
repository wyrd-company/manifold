// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { parseDocument, isMap, isSeq } from "yaml";
import type { TaskFieldEdit } from "@wyrd-company/manifold-shared/declarations-api";
export function declaredRepositories(text: string, binding: string): string[] {
  const document = parseDocument(text);
  const project = document.getIn(["projects", binding]);
  const repositories = isMap(project) ? project.get("repositories") : undefined;
  return isSeq(repositories)
    ? repositories.toJSON().filter((r: unknown): r is string => typeof r === "string")
    : [];
}
export function RepositoriesEditor({
  binding,
  repositories,
  disabled,
  onEdit,
}: {
  binding: string;
  repositories: readonly string[];
  disabled: boolean;
  onEdit: (edit: TaskFieldEdit) => void;
}) {
  const [value, setValue] = useState(repositories.join(", "));
  const commit = () => {
    const entries = value
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (entries.join() !== repositories.join())
      onEdit({ kind: "set-repositories", binding, repositories: entries });
  };
  return (
    <div className="field-repositories">
      <label>
        Repositories
        <input
          aria-label={`Repositories of ${binding}`}
          value={value}
          disabled={disabled}
          placeholder="owner/name, owner/*"
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <p className="muted">
        Labels and milestones are configured here. owner/* reaches repositories with issues on this
        Project.
      </p>
      <div>
        {repositories.map((repository) => (
          <span className="mono" key={repository}>
            {repository}{" "}
          </span>
        ))}
      </div>
    </div>
  );
}
