// ---
// relationships:
//   implements: task-metadata
// ---
import { isMap, isSeq, isScalar } from "yaml";
import type { Document } from "yaml";
import type { PlanChange, PlanInput } from "./project-types.ts";
/** Accept every declaration of an entity; YAML nodes retain unrelated fields and comments. */
export function acceptRepositoryEntities(
  document: Document,
  changes: readonly PlanChange[],
  input: PlanInput,
) {
  const accepted = new Set<string>();
  for (const change of changes) {
    if (
      change.side !== "declaration" ||
      (change.storage !== "label" && change.storage !== "milestone") ||
      !change.to
    )
      continue;
    const scope = input.scopes?.find(
      (s) => s.scope.kind === "repository" && s.scope.repository === change.scope?.name,
    );
    const entity = scope?.owned.entities.find(
      (e) => e.name === change.target.field && e.storage === change.storage,
    );
    if (!entity) throw new TypeError("Accepted repository entity is not owned");
    for (const declaration of entity.declarations) {
      const key = `${declaration.binding}:${declaration.field}:${entity.key}`;
      if (accepted.has(key)) continue;
      accepted.add(key);
      const node = document.getIn(["projects", declaration.binding, "fields", declaration.field]);
      if (!isMap(node)) throw new TypeError("Accepted field is not a mapping");
      const storage = node.get("storage");
      const prefix =
        change.storage === "label" && isMap(storage) ? String(storage.get("prefix") ?? "") : "";
      if (!change.to.name.startsWith(prefix))
        throw new TypeError("Accepted label is outside its prefix");
      const options = node.get("options");
      if (!isSeq(options)) throw new TypeError("Accepted field has no options");
      const oldName = entity.name.slice(prefix.length);
      const option = options.items.find((o) =>
        isMap(o) ? o.get("name") === oldName : isScalar(o) && o.value === oldName,
      );
      if (!option) throw new TypeError("Accepted entity has no declared option");
      const name = change.to.name.slice(prefix.length);
      if (isMap(option)) {
        option.set("name", name);
        if (option.has("color") && "color" in change.to) option.set("color", change.to.color);
        if (option.has("description") && "description" in change.to)
          option.set("description", change.to.description);
      } else options.set(options.items.indexOf(option), name);
    }
  }
}
