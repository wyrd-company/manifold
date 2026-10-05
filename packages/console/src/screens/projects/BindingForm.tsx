// ---
// relationships:
//   implements: operator-console
// ---
import type { ReactNode } from "react";
import type {
  BindingsResponse,
  DeclarationFinding,
} from "@wyrd-company/manifold-shared/declarations-api";
export function BindingChoices({
  bindings,
  environment,
  item,
  onEnvironment,
  onItem,
}: {
  bindings: BindingsResponse;
  environment: string;
  item: string;
  onEnvironment: (v: string) => void;
  onItem: (v: string) => void;
}) {
  return (
    <>
      <label>
        Environment
        <select value={environment} onChange={(e) => onEnvironment(e.target.value)}>
          {bindings.environments.map((e) => (
            <option key={e.name}>{e.name}</option>
          ))}
        </select>
      </label>
      <label>
        Portfolio item
        <select value={item} onChange={(e) => onItem(e.target.value)}>
          <option value="">Choose an item</option>
          {bindings.items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.title ? `${i.title} · ${i.id}` : i.id}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
export function ProjectChoices({
  bindings,
  environment,
  binding,
  checked,
  onChecked,
}: {
  bindings: BindingsResponse;
  environment: string;
  binding?: string;
  checked: readonly string[];
  onChecked: (ids: string[]) => void;
}) {
  const projects = bindings.environments.find((e) => e.name === environment)?.projects;
  const held = new Set([
    ...bindings.githubProjects
      .filter((b) => !b.archived && b.name !== binding && b.environment === environment)
      .flatMap((b) => b.t3codeProjects),
    ...bindings.t3codeProjects
      .filter((b) => !b.archived && b.name !== binding && b.environment === environment)
      .map((b) => b.project),
  ]);
  return projects ? (
    <div className="binding-project-choices">
      {projects
        .filter((p) => !held.has(p.id))
        .map((p) => (
          <label key={p.id}>
            <input
              type="checkbox"
              checked={checked.includes(p.id)}
              onChange={(e) =>
                onChecked(
                  e.target.checked ? [...checked, p.id] : checked.filter((id) => id !== p.id),
                )
              }
            />
            <span className="mono">
              {p.title}
              <small className="muted">{p.workspaceRoot}</small>
            </span>
          </label>
        ))}
    </div>
  ) : (
    <p className="muted">Manifold has not read the projects of {environment} yet.</p>
  );
}
export function BindingFindings({
  findings,
  name,
  member,
}: {
  findings: readonly DeclarationFinding[];
  name: string;
  member?: string;
}) {
  const escaped = name.replace(/~/g, "~0").replace(/\//g, "~1");
  const matched = findings.filter((f) => {
    const tail = f.location
      .replace(/^\/(githubProjects|t3codeProjects)\//, "")
      .slice(escaped.length);
    return member
      ? tail === `/${member}` || tail.startsWith(`/${member}/`)
      : !["owner", "number", "environment", "item", "t3codeProjects", "project"].some(
          (m) => tail === `/${m}` || tail.startsWith(`/${m}/`),
        );
  });
  return (
    <>
      {matched.map((f) => (
        <p role="alert" className="error-text" key={f.location + f.kind}>
          {f.message}
        </p>
      ))}
    </>
  );
}
export function BindingNotice({
  error,
  saved,
  children,
}: {
  error: string | undefined;
  saved: string | undefined;
  children: ReactNode;
}) {
  return saved ? (
    <p role="status" className="blueprint-info">
      Saved as {saved.slice(0, 7)}. The service has not loaded it yet.
    </p>
  ) : (
    <>
      {error ? (
        <p role="alert" className="error-alert">
          {error}
        </p>
      ) : null}
      {children}
    </>
  );
}
