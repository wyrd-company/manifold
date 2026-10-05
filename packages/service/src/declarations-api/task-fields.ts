// ---
// relationships:
//   implements: declarations-api
// ---
import { parseDocument, isMap, isScalar, isSeq } from "yaml";
import { findingRanges } from "@wyrd-company/manifold-shared";
import type { TaskField } from "@wyrd-company/manifold-shared/declarations-api";
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
export function taskFieldRows(text: string): TaskField[] | undefined {
  const doc = parseDocument(text, { version: "1.2" });
  if (doc.errors.length || doc.warnings.length) return;
  const projects = doc.get("projects", true);
  if (!isMap(projects)) return [];
  const rows: TaskField[] = [];
  for (const entry of projects.items) {
    const binding = isScalar(entry.key)
      ? typeof entry.key.value === "string"
        ? entry.key.value
        : (entry.key.source ?? String(entry.key.value))
      : String(entry.key);
    const bindingKey = isScalar(entry.key) ? String(entry.key.value) : String(entry.key);
    if (!isMap(entry.value)) continue;
    const lifecycle = entry.value.get("lifecycle", true);
    const fields = entry.value.get("fields", true);
    function row(node: unknown, name: string, location: string, locked: boolean) {
      if (!isMap(node)) return;
      const string = (key: string) =>
        typeof node.get(key) === "string" ? (node.get(key) as string) : undefined;
      const storage = node.get("storage", true);
      const kind =
        isMap(storage) && typeof storage.get("kind") === "string"
          ? (storage.get("kind") as string)
          : undefined;
      const settings: Record<string, string> = {};
      if (isMap(storage))
        for (const pair of storage.items)
          if (
            isScalar(pair.key) &&
            pair.key.value !== "kind" &&
            isScalar(pair.value) &&
            typeof pair.value.value === "string"
          )
            settings[String(pair.key.value)] = pair.value.value;
      const optionsNode = node.get("options", true);
      const options = isSeq(optionsNode) ? optionsNode.toJSON() : undefined;
      const optionNames = Array.isArray(options)
        ? options.flatMap((option: unknown) =>
            typeof option === "string"
              ? [option]
              : typeof option === "object" &&
                  option !== null &&
                  "name" in option &&
                  typeof option.name === "string"
                ? [option.name]
                : [],
          )
        : undefined;
      const range = findingRanges(text, [{ kind: "field", location, message: "" }])[0]?.range;
      rows.push({
        binding,
        name,
        lifecycle: locked,
        location,
        ...(range ? { range } : {}),
        ...(locked
          ? { type: "single-select", storage: "project-field" }
          : {
              ...(string("type") !== undefined ? { type: string("type")! } : {}),
              ...(kind !== undefined ? { storage: kind } : {}),
              ...(string("whenChanged") !== undefined
                ? { whenChanged: string("whenChanged")! }
                : {}),
            }),
        ...(Object.keys(settings).length ? { settings } : {}),
        ...(optionNames ? { options: optionNames } : {}),
      });
    }
    if (isMap(lifecycle))
      row(
        lifecycle,
        typeof lifecycle.get("field") === "string" ? (lifecycle.get("field") as string) : "",
        `/projects/${pointer(bindingKey)}/lifecycle`,
        true,
      );
    if (isMap(fields))
      for (const field of fields.items) {
        const name = isScalar(field.key)
          ? typeof field.key.value === "string"
            ? field.key.value
            : (field.key.source ?? String(field.key.value))
          : String(field.key);
        const fieldKey = isScalar(field.key) ? String(field.key.value) : String(field.key);
        row(
          field.value,
          name,
          `/projects/${pointer(bindingKey)}/fields/${pointer(fieldKey)}`,
          false,
        );
      }
  }
  return rows;
}
