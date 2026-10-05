// ---
// relationships:
//   implements: declarations-api
// ---
import { parseDocument, isMap, isScalar, isSeq, visit } from "yaml";
import type { TaskFieldEdit } from "@wyrd-company/manifold-shared/declarations-api";
const pointer = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
export function editTaskFields(text: string, edit: TaskFieldEdit) {
  const doc = parseDocument(text, { version: "1.2" });
  const fail = (kind: string, location: string, message: string) => ({
    ok: false as const,
    findings: [{ kind, location, message }],
  });
  if (doc.errors.length) return fail("syntax", "", doc.errors[0]!.message);
  // YAML's serializer normalizes non-string scalars, including numeric keys.
  // Keep their written form when this edit did not change their value.
  const original = new WeakMap<object, unknown>();
  visit(doc, {
    Scalar: (_key, node) => {
      original.set(node, node.value);
    },
  });
  doc.schema.tags = doc.schema.tags.map((tag) => {
    const stringify = tag.stringify;
    if (!stringify) return tag;
    return {
      ...tag,
      stringify(node, ...args) {
        if (
          isScalar(node) &&
          typeof node.value !== "string" &&
          node.source !== undefined &&
          original.has(node) &&
          Object.is(original.get(node), node.value)
        )
          return node.source;
        return stringify(node, ...args);
      },
    };
  });
  if (edit.kind === "add-field") {
    const projects = doc.get("projects", true);
    const project = isMap(projects)
      ? projects.items.find(
          (pair) =>
            isScalar(pair.key) &&
            (typeof pair.key.value === "string"
              ? pair.key.value
              : (pair.key.source ?? String(pair.key.value))) === edit.binding,
        )
      : undefined;
    const binding = project && isScalar(project.key) ? project.key.value : edit.binding;
    if (
      !project &&
      (edit.binding.length > 64 || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(edit.binding))
    )
      return fail("bad-binding", "/projects", "Expected a Project binding.");
    if (!project) doc.setIn(["projects", binding], doc.createNode({}));
    const target = project?.value ?? doc.getIn(["projects", binding], true);
    if (!isMap(target)) return fail("schema", "/projects", "Expected a Project mapping.");
    if (!target.has("fields")) target.set("fields", doc.createNode({}));
    const fields = target.get("fields", true);
    if (!isMap(fields)) return fail("schema", "/projects", "Expected a fields mapping.");
    let n = 1;
    while (fields.has(`field-${n}`)) n++;
    fields.set(`field-${n}`, doc.createNode({ type: "text" }));
    return {
      ok: true as const,
      text: doc.toString({ lineWidth: 0 }),
      location: `/projects/${pointer(String(binding))}/fields/field-${n}`,
    };
  }
  const path = edit.location
    .split("/")
    .slice(1)
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
  const locked = path.length === 3 && path[0] === "projects" && path[2] === "lifecycle";
  if (!locked && !(path.length === 4 && path[0] === "projects" && path[2] === "fields"))
    return fail("field-missing", edit.location, "Field does not exist.");
  const yamlPath: unknown[] = [];
  for (const segment of path) {
    const parent = doc.getIn(yamlPath, true);
    const pair = isMap(parent)
      ? parent.items.find((pair) => isScalar(pair.key) && String(pair.key.value) === segment)
      : undefined;
    yamlPath.push(pair && isScalar(pair.key) ? pair.key.value : segment);
  }
  const node = doc.getIn(yamlPath, true);
  if (!isMap(node)) return fail("field-missing", edit.location, "Field does not exist.");
  if (
    locked &&
    (edit.kind === "remove-field" ||
      ["type", "storage", "whenChanged"].some((key) => key in edit.values))
  )
    return fail("field-locked", edit.location, "Lifecycle field is locked.");
  let location = edit.location;
  if (edit.kind === "remove-field") doc.deleteIn(yamlPath);
  else {
    const values = edit.values;
    if (values.name !== undefined) {
      if (locked) node.set("field", values.name);
      else {
        const fields = doc.getIn(yamlPath.slice(0, -1), true);
        if (isMap(fields)) {
          if (values.name !== path.at(-1) && fields.has(values.name))
            return fail("name-taken", location, "Field name is already used.");
          const pair = fields.items.find(
            (pair) => isScalar(pair.key) && String(pair.key.value) === path.at(-1),
          );
          if (pair && isScalar(pair.key)) pair.key.value = values.name;
          location = path.slice(0, -1).map(pointer).join("/");
          location = `/${location}/${pointer(values.name)}`;
        }
      }
    }
    if (values.type !== undefined) {
      node.set("type", values.type);
      if (values.type !== "single-select") node.delete("options");
    }
    if (values.whenChanged !== undefined) node.set("whenChanged", values.whenChanged);
    if (values.storage !== undefined) {
      const current = node.get("storage", true);
      const changed = !isMap(current) || current.get("kind") !== values.storage;
      if (changed && isMap(current)) {
        for (const pair of current.items.slice())
          if (isScalar(pair.key) && !["kind", "name"].includes(String(pair.key.value)))
            current.delete(pair.key.value);
        current.set("kind", values.storage);
      } else if (changed) node.set("storage", doc.createNode({ kind: values.storage }));
      else current.set("kind", values.storage);
    }
    if (values.settings !== undefined) {
      if (!isMap(node.get("storage", true)))
        node.set("storage", doc.createNode({ kind: "project-field" }));
      const storage = node.get("storage", true);
      if (isMap(storage))
        for (const [key, value] of Object.entries(values.settings)) storage.set(key, value);
    }
    if (values.options !== undefined && (locked || node.get("type") === "single-select")) {
      const old = node.get("options", true);
      const previous = isSeq(old) ? old.items : [];
      const names = previous.map((option) =>
        isScalar(option) && typeof option.value === "string"
          ? option.value
          : isMap(option) && typeof option.get("name") === "string"
            ? (option.get("name") as string)
            : undefined,
      );
      const removed = names.filter((name) => name !== undefined && !values.options!.includes(name));
      const added = values.options.filter((name) => !names.includes(name));
      const updated = values.options.map((name) => {
        let index = names.indexOf(name);
        if (index < 0 && removed.length === 1 && added.length === 1)
          index = names.indexOf(removed[0]);
        const oldOption = previous[index];
        if (isMap(oldOption)) {
          oldOption.set("name", name);
          return oldOption;
        }
        if (isScalar(oldOption)) {
          oldOption.value = name;
          return oldOption;
        }
        return name;
      });
      const sequence = doc.createNode(updated);
      node.set("options", sequence);
    }
  }
  return { ok: true as const, text: doc.toString({ lineWidth: 0 }), location };
}
