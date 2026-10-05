// ---
// relationships:
//   implements: operator-console
// ---
import { isAlias, isMap, isScalar, isSeq, parseDocument, stringify } from "yaml";
import type { Node as YamlNode } from "yaml";
import { blueprintGraph } from "@wyrd-company/manifold-shared/blueprint-graph";
import type { BlueprintGraph } from "@wyrd-company/manifold-shared/blueprints-api";
import type { BlueprintDraft } from "./draft.ts";
import { changeDraft } from "./draft.ts";
export type StateType = "atomic" | "compound" | "parallel" | "final" | "history";
export type BlueprintEdit =
  | { kind: "set"; pointer: string; value: unknown }
  | { kind: "remove"; pointer: string }
  | { kind: "rename-key"; pointer: string; key: string }
  | { kind: "add-state"; parent: string; type: StateType; position?: { x: number; y: number } }
  | { kind: "rename-state"; path: string; key: string }
  | { kind: "remove-state"; path: string }
  | { kind: "set-initial"; parent: string; key: string }
  | {
      kind: "add-transition";
      source: string;
      target: string;
      trigger: "event" | "always" | "after" | "done" | "error";
      event?: string;
      invoke?: number;
    }
  | { kind: "remove-transition"; pointer: string }
  | { kind: "move-candidate"; pointer: string; direction: -1 | 1 }
  | { kind: "set-layout"; states: Record<string, { x: number; y: number }> }
  | { kind: "clear-layout" };
export const pointerKey = (key: string) => key.replaceAll("~", "~0").replaceAll("/", "~1");
export const pointerParts = (pointer: string) =>
  pointer
    .split("/")
    .slice(1)
    .map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"));
export const statePointer = (path: string) =>
  "/machine" +
  path
    .split(".")
    .filter(Boolean)
    .map((key) => "/states/" + pointerKey(key))
    .join("");
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function atPointer(value: unknown, pointer: string): unknown {
  return pointerParts(pointer).reduce<unknown>(
    (row, key) => (Array.isArray(row) ? row[Number(key)] : object(row)[key]),
    value,
  );
}
class EditError extends Error {
  readonly reason: "unsafe" | "missing" | "invalid";
  constructor(reason: "unsafe" | "missing" | "invalid", message: string) {
    super(message);
    this.reason = reason;
  }
}
function fail(reason: EditError["reason"], message: string): never {
  throw new EditError(reason, message);
}
function setAt(value: unknown, pointer: string, next: unknown, remove = false) {
  const keys = pointerParts(pointer);
  const key = keys.pop()!;
  let parent = value;
  for (const part of keys) {
    const container = object(parent);
    if (Array.isArray(parent) ? !Object.hasOwn(parent, part) : !Object.hasOwn(container, part))
      fail("missing", "The parent property is no longer present.");
    parent = Array.isArray(parent) ? parent[Number(part)] : container[part];
  }
  if (parent === null || typeof parent !== "object")
    fail("missing", "The parent property is no longer present.");
  if (Array.isArray(parent)) {
    if (!Object.hasOwn(parent, key)) fail("missing", "The candidate is no longer present.");
    if (remove) parent.splice(Number(key), 1);
    else parent[Number(key)] = next;
  } else if (remove) delete object(parent)[key];
  else object(parent)[key] = next;
}
function keyValid(key: string, siblings: Record<string, unknown>, current?: string) {
  if (!key || /[.#]/.test(key) || (key !== current && key in siblings))
    fail("invalid", "Use a non-empty, unique key without . or #.");
}
function renameAt(value: unknown, pointer: string, key: string) {
  const parts = pointerParts(pointer);
  const old = parts.pop()!;
  const parentPointer = "/" + parts.map(pointerKey).join("/");
  const parent = object(atPointer(value, parentPointer));
  if (Object.hasOwn(parent, key) && key !== old) fail("invalid", "The key is already present.");
  if (!(old in parent)) fail("missing", "The key is no longer present.");
  const renamed = Object.fromEntries(
    Object.entries(parent).map(([name, child]) => [name === old ? key : name, child]),
  );
  setAt(value, parentPointer, renamed);
}
export function shortestTarget(source: string, target: string, id: string) {
  if (!source) return "." + target;
  if (target.startsWith(source + ".")) return "." + target.slice(source.length + 1);
  const parent = source.split(".").slice(0, -1).join(".");
  if (!parent) return target;
  if (target.startsWith(parent + ".")) return target.slice(parent.length + 1);
  return "#" + id + (target ? "." + target : "");
}
function rewriteTarget(raw: string, oldPath: string, newPath: string) {
  const oldKey = oldPath.split(".").at(-1)!;
  const newKey = newPath.split(".").at(-1)!;
  const segments = raw.split(".");
  // Prefer the full path; relative references have its terminal suffix.
  for (let count = oldPath.split(".").length; count >= 1; count--) {
    const suffix = oldPath.split(".").slice(-count).join(".");
    const index = raw.indexOf(suffix);
    if (
      index >= 0 &&
      (index === 0 || raw[index - 1] === ".") &&
      (index + suffix.length === raw.length || raw[index + suffix.length] === ".")
    )
      return (
        raw.slice(0, index) +
        suffix
          .split(".")
          .map((part, i) => (i === count - 1 ? newKey : part))
          .join(".") +
        raw.slice(index + suffix.length)
      );
  }
  return segments.map((part) => (part === oldKey ? newKey : part)).join(".");
}
function editData(value: unknown, edit: BlueprintEdit, graph?: BlueprintGraph) {
  let select: string | undefined;
  const machine = object(object(value)["machine"]);
  switch (edit.kind) {
    case "set": {
      if (/^\/machine(?:\/states\/[^/]+)*\/id$/.test(edit.pointer)) {
        const old = atPointer(value, edit.pointer);
        const visit = (row: unknown) => {
          if (Array.isArray(row)) row.forEach(visit);
          else
            for (const [key, child] of Object.entries(object(row))) {
              if (
                key === "target" &&
                typeof child === "string" &&
                typeof old === "string" &&
                (child === "#" + old || child.startsWith("#" + old + "."))
              )
                object(row)[key] = "#" + String(edit.value) + child.slice(old.length + 1);
              else if (key === "target" && Array.isArray(child))
                object(row)[key] = child.map((t) =>
                  typeof t === "string" &&
                  typeof old === "string" &&
                  (t === "#" + old || t.startsWith("#" + old + "."))
                    ? "#" + String(edit.value) + t.slice(old.length + 1)
                    : t,
                );
              else visit(child);
            }
        };
        visit(machine);
        for (const edge of graph?.transitions ?? []) {
          const row = atPointer(value, edge.location);
          if (
            typeof row === "string" &&
            typeof old === "string" &&
            (row === "#" + old || row.startsWith("#" + old + "."))
          )
            setAt(value, edge.location, "#" + String(edit.value) + row.slice(old.length + 1));
        }
      }
      setAt(value, edit.pointer, edit.value);
      break;
    }
    case "remove":
    case "remove-transition":
      if (atPointer(value, edit.pointer) === undefined)
        fail("missing", "The property is no longer present.");
      setAt(value, edit.pointer, undefined, true);
      if (edit.kind === "remove-transition")
        select = graph?.transitions.find((row) => row.location === edit.pointer)?.source ?? "";
      break;
    case "rename-key":
      renameAt(value, edit.pointer, edit.key);
      break;
    case "set-initial":
      setAt(value, statePointer(edit.parent) + "/initial", edit.key);
      break;
    case "add-state": {
      const parentPointer = statePointer(edit.parent);
      const parent = atPointer(value, parentPointer);
      if (!parent) fail("missing", "The parent state is no longer present.");
      const siblings = object(object(parent)["states"]);
      const base = edit.type === "atomic" ? "state" : edit.type;
      let key = base;
      for (let n = 2; key in siblings; n++) key = base + "-" + n;
      const child =
        edit.type === "atomic"
          ? {}
          : edit.type === "compound"
            ? { initial: "state", states: { state: {} } }
            : edit.type === "parallel"
              ? { type: "parallel", states: { "region-1": {}, "region-2": {} } }
              : { type: edit.type };
      setAt(value, parentPointer + "/states", { ...siblings, [key]: child });
      if (object(parent)["type"] !== "parallel" && !object(parent)["initial"])
        setAt(value, parentPointer + "/initial", key);
      select = [edit.parent, key].filter(Boolean).join(".");
      if (object(value)["layout"] && edit.position)
        setAt(value, "/layout", {
          states: {
            ...(object(object(value)["layout"])["states"] as object),
            [select]: edit.position,
          },
        });
      break;
    }
    case "rename-state":
    case "remove-state": {
      const pointer = statePointer(edit.path);
      const row = atPointer(value, pointer);
      if (row === undefined) fail("missing", "The state is no longer present.");
      const parentPath = edit.path.split(".").slice(0, -1).join(".");
      const parent = object(atPointer(value, statePointer(parentPath)));
      const oldKey = edit.path.split(".").at(-1)!;
      const siblings = object(parent["states"]);
      const renaming = edit.kind === "rename-state";
      const newPath = renaming ? [parentPath, edit.key].filter(Boolean).join(".") : "";
      if (renaming) keyValid(edit.key, siblings, oldKey);
      const removedLocations = new Set<string>();
      for (const edge of [...(graph?.transitions ?? [])].sort((a, b) =>
        b.location.localeCompare(a.location, undefined, { numeric: true }),
      )) {
        if (!edge.target || !(edge.target === edit.path || edge.target.startsWith(edit.path + ".")))
          continue;
        if (removedLocations.has(edge.location)) continue;
        const transition = atPointer(value, edge.location);
        const targets = typeof transition === "string" ? transition : object(transition)["target"];
        if (typeof targets === "string") {
          if (renaming)
            setAt(
              value,
              edge.location + (typeof transition === "string" ? "" : "/target"),
              rewriteTarget(targets, edit.path, newPath),
            );
          else {
            setAt(value, edge.location, undefined, true);
            removedLocations.add(edge.location);
          }
        } else if (Array.isArray(targets)) {
          const resolved = (graph?.transitions ?? []).filter(
            (item) => item.location === edge.location,
          );
          const next = targets.flatMap((raw, i) => {
            const target = resolved[i]?.target;
            const matches = target === edit.path || target?.startsWith(edit.path + ".");
            return matches
              ? renaming
                ? [rewriteTarget(String(raw), edit.path, newPath)]
                : []
              : [raw];
          });
          if (next.length) setAt(value, edge.location + "/target", next);
          else {
            setAt(value, edge.location, undefined, true);
            removedLocations.add(edge.location);
          }
        }
      }
      if (parent["initial"] === oldKey) {
        const next = renaming ? edit.key : Object.keys(siblings).find((key) => key !== oldKey);
        setAt(value, statePointer(parentPath) + "/initial", next, next === undefined);
      }
      const positions = object(object(object(value)["layout"])["states"]);
      for (const path of Object.keys(positions))
        if (path === edit.path || path.startsWith(edit.path + ".")) {
          if (renaming)
            renameAt(
              value,
              "/layout/states/" + pointerKey(path),
              newPath + path.slice(edit.path.length),
            );
          else delete positions[path];
        }
      if (renaming) {
        const visit = (row: unknown) => {
          if (Array.isArray(row)) row.forEach(visit);
          else
            for (const [key, child] of Object.entries(object(row))) {
              if (
                (key === "params" && object(row)["type"] === "in") ||
                key === "dependencies" ||
                (key === "state" && typeof child === "string") ||
                (key === "target" && object(row)["type"] === "history")
              ) {
                const replace = (raw: unknown) =>
                  typeof raw === "string" && (raw === edit.path || raw.startsWith(edit.path + "."))
                    ? newPath + raw.slice(edit.path.length)
                    : raw;
                object(row)[key] =
                  key === "params"
                    ? {
                        ...object(child),
                        states: Array.isArray(object(child)["states"])
                          ? (object(child)["states"] as unknown[]).map(replace)
                          : object(child)["states"],
                      }
                    : Array.isArray(child)
                      ? child.map(replace)
                      : replace(child);
              } else visit(child);
            }
        };
        visit(machine);
        renameAt(value, pointer, edit.key);
        select = newPath;
      } else {
        setAt(value, pointer, undefined, true);
        select = parentPath;
      }
      break;
    }
    case "add-transition": {
      const source = statePointer(edit.source);
      if (!atPointer(value, source) || !atPointer(value, statePointer(edit.target)))
        fail("missing", "The connected state is no longer present.");
      const target = shortestTarget(edit.source, edit.target, String(machine["id"] ?? "(machine)"));
      const invoke = atPointer(value, source + "/invoke");
      const rows = invoke === undefined ? [] : Array.isArray(invoke) ? invoke : [invoke];
      const hasChildren = Object.keys(object(atPointer(value, source + "/states"))).length > 0;
      const invokeIndex = edit.invoke ?? (rows.length === 1 && !hasChildren ? 0 : undefined);
      if (
        (edit.trigger === "error" || (edit.trigger === "done" && !hasChildren)) &&
        invokeIndex === undefined
      )
        fail("missing", "Choose an existing invoke for this transition.");
      const invokePath = source + "/invoke" + (Array.isArray(invoke) ? "/" + invokeIndex : "");
      const pointer =
        edit.trigger === "event"
          ? source + "/on/" + pointerKey(edit.event ?? "EVENT")
          : edit.trigger === "after"
            ? source + "/after/" + pointerKey(edit.event ?? "1000")
            : edit.trigger === "always"
              ? source + "/always"
              : edit.trigger === "error"
                ? invokePath + "/onError"
                : invokeIndex !== undefined
                  ? invokePath + "/onDone"
                  : source + "/onDone";
      if (
        (edit.trigger === "event" || edit.trigger === "after") &&
        atPointer(value, pointer.slice(0, pointer.lastIndexOf("/"))) === undefined
      )
        setAt(value, source + (edit.trigger === "event" ? "/on" : "/after"), {});
      const existing = atPointer(value, pointer);
      setAt(
        value,
        pointer,
        existing === undefined
          ? target
          : [...(Array.isArray(existing) ? existing : [existing]), target],
      );
      select =
        pointer +
        (existing === undefined ? "" : "/" + (Array.isArray(existing) ? existing.length : 1));
      break;
    }
    case "move-candidate": {
      const parts = pointerParts(edit.pointer);
      const index = Number(parts.pop());
      const parentPointer = "/" + parts.map(pointerKey).join("/");
      const rows = atPointer(value, parentPointer);
      if (!Array.isArray(rows) || index < 0 || index >= rows.length)
        fail("missing", "The candidate is no longer present.");
      const next = index + edit.direction;
      if (next >= 0 && next < rows.length) [rows[index], rows[next]] = [rows[next], rows[index]];
      select = parentPointer + "/" + next;
      break;
    }
    case "set-layout":
      setAt(value, "/layout", { states: edit.states });
      break;
    case "clear-layout":
      setAt(value, "/layout", undefined, true);
      break;
  }
  return select;
}
type Splice = { from: number; to: number; text: string };
function unsafe(node: unknown): boolean {
  if (isAlias(node)) return true;
  if (isScalar(node) && node.anchor) return true;
  if (isMap(node))
    return !!node.anchor || node.items.some((pair) => unsafe(pair.key) || unsafe(pair.value));
  if (isSeq(node)) return !!node.anchor || node.items.some(unsafe);
  return false;
}
export function applyBlueprintEdit(text: string, edit: BlueprintEdit, graph?: BlueprintGraph) {
  try {
    const document = parseDocument(text, { keepSourceTokens: true });
    if (document.errors.length)
      fail("unsafe", "This edit cannot be made on the canvas. Make it in the YAML view.");
    const before: unknown = document.toJS();
    const after: unknown = structuredClone(before);
    const references =
      edit.kind === "rename-state" ||
      edit.kind === "remove-state" ||
      (edit.kind === "set" && /^\/machine(?:\/states\/[^/]+)*\/id$/.test(edit.pointer))
        ? (blueprintGraph(text, true) ?? graph)
        : graph;
    const select = editData(after, edit, references);
    const splices: Splice[] = [];
    const render = (value: unknown, indent: number, style?: string) => {
      if (typeof value === "string" && style === "QUOTE_SINGLE" && !value.includes("\n"))
        return "'" + value.replaceAll("'", "''") + "'";
      if (typeof value === "string" && style === "QUOTE_DOUBLE") return JSON.stringify(value);
      if (
        typeof value === "string" &&
        (value.includes("\n") || style === "BLOCK_LITERAL" || style === "BLOCK_FOLDED")
      )
        return (
          "|-\n" +
          value
            .split("\n")
            .map((line) => " ".repeat(indent + 2) + line)
            .join("\n") +
          "\n"
        );
      return stringify(value, { lineWidth: 0 })
        .trimEnd()
        .split("\n")
        .map((line, i) => (i ? " ".repeat(indent) : "") + line)
        .join("\n");
    };
    function patch(
      node: YamlNode | null,
      old: unknown,
      next: unknown,
      indent: number,
      flowContext = false,
    ) {
      if (equal(old, next)) return;
      if (!node?.range || (isMap(node) && node.anchor) || isAlias(node))
        fail("unsafe", "This edit cannot be made on the canvas. Make it in the YAML view.");
      if (isMap(node) && !Array.isArray(next) && next !== null && typeof next === "object") {
        const oldMap = object(old);
        const newMap = object(next);
        const oldKeys = Object.keys(oldMap);
        const newKeys = Object.keys(newMap);
        // A key rename keeps its value and all surrounding bytes.
        const gone = oldKeys.filter((key) => !(key in newMap));
        const added = newKeys.filter((key) => !(key in oldMap));
        if (gone.length === 1 && added.length === 1 && equal(oldMap[gone[0]!], newMap[added[0]!])) {
          const pair = node.items.find(
            (item) => String(isScalar(item.key) ? item.key.value : "") === gone[0],
          );
          if (isScalar(pair?.key) && pair.key.range) {
            splices.push({
              from: pair.key.range[0],
              to: pair.key.range[1],
              text: render(added[0], indent, pair.key.type),
            });
            for (const key of oldKeys.filter((key) => key !== gone[0]))
              patch(
                node.get(key, true) as YamlNode,
                oldMap[key],
                newMap[key],
                indent + 2,
                flowContext || !!node.flow,
              );
            return;
          }
        }
        if ((node.flow || newKeys.length === 0) && (gone.length || added.length)) {
          const rendered = document.createNode(next);
          if (isMap(rendered)) rendered.flow = true;
          splices.push({ from: node.range[0], to: node.range[1], text: rendered.toString() });
          return;
        }
        for (const pair of node.items) {
          if (!isScalar(pair.key) || !pair.key.range)
            fail("unsafe", "Complex keys need the YAML view.");
          const key = String(pair.key.value);
          if (!(key in newMap)) {
            if (unsafe(pair.value))
              fail("unsafe", "This edit cannot be made on the canvas. Make it in the YAML view.");
            const from = text.lastIndexOf("\n", pair.key.range[0] - 1) + 1;
            const value = pair.value as YamlNode | null;
            const end = value?.range?.[2] ?? pair.key.range[2];
            const to =
              end > from && text[end - 1] === "\n"
                ? end
                : text.indexOf("\n", end) < 0
                  ? text.length
                  : text.indexOf("\n", end) + 1;
            splices.push({ from, to, text: "" });
          } else
            patch(
              pair.value as YamlNode,
              oldMap[key],
              newMap[key],
              text.slice(text.lastIndexOf("\n", pair.key.range[0] - 1) + 1, pair.key.range[0])
                .length + 2,
              flowContext || !!node.flow,
            );
        }
        if (added.length) {
          const first = node.items[0]?.key;
          const indentation =
            isScalar(first) && first.range
              ? text.slice(text.lastIndexOf("\n", first.range[0] - 1) + 1, first.range[0]).length
              : indent;
          const insertion = node.range[2];
          splices.push({
            from: insertion,
            to: insertion,
            text:
              (text[insertion - 1] === "\n" ? "" : "\n") +
              stringify(Object.fromEntries(added.map((key) => [key, newMap[key]])), {
                lineWidth: 0,
              })
                .trimEnd()
                .split("\n")
                .map((line) => " ".repeat(indentation) + line)
                .join("\n") +
              "\n",
          });
        }
      } else {
        if (unsafe(node))
          fail("unsafe", "This edit cannot be made on the canvas. Make it in the YAML view.");
        const rendered = document.createNode(next);
        if (flowContext && (isMap(rendered) || isSeq(rendered))) rendered.flow = true;
        if (isMap(rendered) && isMap(node) && node.flow) rendered.flow = true;
        if (isSeq(rendered) && isSeq(node) && node.flow) rendered.flow = true;
        const replacement =
          (isMap(rendered) || isSeq(rendered)) && rendered.flow
            ? rendered.toString()
            : render(next, indent, isScalar(node) ? node.type : undefined);
        splices.push({
          from: node.range[0],
          to: node.range[1],
          text:
            ((isMap(rendered) || isSeq(rendered)) && !rendered.flow && isScalar(node)
              ? "\n" + " ".repeat(indent)
              : "") +
            replacement +
            ((isMap(node) || isSeq(node)) && !node.flow && text[node.range[1] - 1] === "\n"
              ? "\n"
              : ""),
        });
      }
    }
    patch(document.contents as YamlNode, before, after, 0);
    let result = text;
    for (const splice of splices.sort((a, b) => b.from - a.from))
      result = result.slice(0, splice.from) + splice.text + result.slice(splice.to);
    const check = parseDocument(result);
    if (check.errors.length || !equal(check.toJS(), after))
      fail("unsafe", "This edit cannot be made on the canvas. Make it in the YAML view.");
    return { ok: true as const, text: result, ...(select === undefined ? {} : { select }) };
  } catch (error) {
    return {
      ok: false as const,
      reason: error instanceof EditError ? error.reason : "unsafe",
      message: error instanceof Error ? error.message : "Cannot edit this YAML.",
    };
  }
}
export function commitEdit(
  draft: BlueprintDraft,
  basis: string,
  edit: BlueprintEdit,
  graph?: BlueprintGraph,
) {
  if (draft.saved)
    return { ok: false as const, reason: "readonly", message: "The saved draft is read only." };
  if (draft.text !== basis)
    return { ok: false as const, reason: "stale", message: "The draft changed during this edit." };
  const result = applyBlueprintEdit(basis, edit, graph);
  return result.ok ? { ...result, draft: changeDraft(draft, result.text) } : result;
}
