// ---
// relationships:
//   implements: task-metadata
// ---
import { isMap, isSeq } from "yaml";
import type { Document } from "yaml";
import type { PlanChange, PlanInput } from "./project-types.ts";

/** Accept changes every declaration that owns the organization entity. */
export function acceptOrganization(document: Document, change: PlanChange, input: PlanInput) {
  const scope = input.scopes?.find(
    (s) => s.scope.kind === "organization" && s.scope.organization === change.scope?.name,
  );
  const entity = scope?.owned.entities.find(
    (e) => e.storage === change.storage && e.name === change.target.field,
  );
  if (!entity) throw new TypeError("Accepted organization entity has no owner");
  for (const declaration of entity.declarations) {
    const path = ["projects", declaration.binding, "fields", declaration.field];
    const node = document.getIn(path);
    if (!isMap(node)) throw new TypeError("Accepted organization field is not a mapping");
    if (change.storage === "issue-field") {
      if (change.action === "remove") {
        document.deleteIn(path);
        continue;
      }
      const to = change.to;
      if (!to || !("type" in to)) throw new TypeError("Accepted issue field has no field target");
      node.set("type", to.type);
      const storage = node.get("storage");
      if (!isMap(storage)) throw new TypeError("Accepted issue field has no storage");
      storage.set("name", to.name);
      if (to.type !== "single-select") {
        node.delete("options");
        continue;
      }
      const declared = node.get("options");
      const old = isSeq(declared)
        ? (declared.toJSON() as (string | { name: string; color?: string; description?: string })[])
        : [];
      const before = scope?.applied?.configuration;
      const observed = scope?.observed;
      const identity = scope?.applied?.owned[entity.key];
      const oldField =
        before?.status === "ready"
          ? before.issueFields.find((f) => f.nodeId === identity)
          : undefined;
      const newField =
        observed?.status === "ready"
          ? observed.issueFields.find((f) => f.nodeId === identity)
          : undefined;
      node.set(
        "options",
        to.options!.map((option) => {
          const id = newField?.options.find((o) => o.name === option.name)?.id;
          const name = oldField?.options.find((o) => o.id === id)?.name ?? option.name;
          const previous = old.find((o) => (typeof o === "string" ? o : o.name) === name);
          return typeof previous === "object"
            ? {
                name: option.name,
                ...(previous.color !== undefined ? { color: option.color } : {}),
                ...(previous.description !== undefined ? { description: option.description } : {}),
              }
            : option.name;
        }),
      );
    } else {
      const options = node.get("options");
      if (!isSeq(options)) throw new TypeError("Accepted issue type has no options");
      const index = options.items.findIndex(
        (o) => String(isMap(o) ? o.get("name") : o).toLowerCase() === entity.name.toLowerCase(),
      );
      if (index < 0) throw new TypeError("Accepted issue type is not declared");
      if (change.action === "remove") {
        options.delete(index);
        if (!options.items.length) document.deleteIn(path);
        continue;
      }
      const to = change.to;
      if (!to || !("entity" in to)) throw new TypeError("Accepted issue type has no entity target");
      const previous = options.items[index];
      if (isMap(previous)) {
        previous.set("name", to.name);
        if (previous.has("color")) previous.set("color", to.color ?? "gray");
        if (previous.has("description")) previous.set("description", to.description);
      } else options.set(index, to.name);
    }
  }
}
