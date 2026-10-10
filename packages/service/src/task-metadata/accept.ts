// ---
// relationships:
//   implements: task-metadata
// ---
import { acceptOrganization } from "./organization-accept.ts";
import { isMap, isSeq, parseDocument } from "yaml";
import { matchFields } from "./plan.ts";
import type { PlanChange, PlanInput } from "./project-types.ts";
/** Change only accepted fields in the document model, preserving unrelated comments and keys. */
export function acceptFields(
  text: string,
  binding: string,
  changes: readonly PlanChange[],
  input: PlanInput,
): string {
  const document = parseDocument(text);
  const matches = matchFields(input);
  for (const change of changes.filter((c) => c.side === "declaration")) {
    if (change.scope?.kind === "organization") {
      acceptOrganization(document, change, input);
      continue;
    }
    const path = ["projects", binding, "fields", change.target.taskField!];
    if (change.action === "remove") {
      document.deleteIn(path);
      continue;
    }
    const observed = change.to!;
    if (!("type" in observed)) continue;
    const node = document.getIn(path);
    if (!isMap(node)) throw new TypeError("Accepted field is not a mapping");
    node.set("type", observed.type);
    node.set("whenChanged", "accept");
    if (observed.name === change.target.taskField) node.delete("storage");
    else {
      const storage = node.get("storage");
      if (isMap(storage)) storage.set("name", observed.name);
      else node.set("storage", { kind: "project-field", name: observed.name });
    }
    const oldOptions = node.get("options");
    const declared = isSeq(oldOptions)
      ? (oldOptions.toJSON() as (string | { name: string; color?: string; description?: string })[])
      : [];
    if (observed.type === "single-select")
      node.set(
        "options",
        observed.options!.map((option, i) => {
          const match = matches.find((m) => m.owned.taskField === change.target.taskField);
          const current = match?.observed?.options[i];
          const oldName =
            match?.before?.options.find((o) => o.id === current?.id)?.name ?? option.name;
          const previous = declared.find((o) =>
            typeof o === "string" ? o === oldName : o.name === oldName,
          );
          return typeof previous === "object" &&
            previous !== null &&
            (previous.color !== undefined || previous.description !== undefined)
            ? {
                name: option.name,
                ...(previous.color !== undefined ? { color: option.color } : {}),
                ...(previous.description !== undefined ? { description: option.description } : {}),
              }
            : option.name;
        }),
      );
    else node.delete("options");
  }
  return document.toString();
}
