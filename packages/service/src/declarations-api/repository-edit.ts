// ---
// relationships:
//   implements: declarations-api
// ---
import { isMap, isScalar } from "yaml";
import type { Document } from "yaml";
import type { TaskFieldEdit } from "@wyrd-company/manifold-shared/declarations-api";
export function editRepositories(
  document: Document,
  edit: Extract<TaskFieldEdit, { kind: "set-repositories" }>,
) {
  const projects = document.get("projects", true);
  const pair = isMap(projects)
    ? projects.items.find((p) => isScalar(p.key) && String(p.key.value) === edit.binding)
    : undefined;
  if (!pair || !isMap(pair.value))
    return {
      ok: false as const,
      findings: [
        { kind: "bad-binding", location: "/projects", message: "Expected a Project binding." },
      ],
    };
  const project = pair.value;
  if (edit.repositories.length) {
    const exists = project.has("repositories");
    project.set("repositories", document.createNode(edit.repositories));
    if (!exists) {
      const repositories = project.items.pop()!;
      const after = project.items.findIndex((p) => isScalar(p.key) && p.key.value === "lifecycle");
      project.items.splice(after + 1, 0, repositories);
    }
  } else project.delete("repositories");
  return {
    ok: true as const,
    text: document.toString({ lineWidth: 0 }),
    location: `/projects/${edit.binding.replaceAll("~", "~0").replaceAll("/", "~1")}`,
  };
}
