// ---
// relationships:
//   implements: [operator-console, decision-models]
// ---
import { isMap, isSeq, isScalar, parseDocument } from "yaml";
import type { Node, Document } from "yaml";
import type { DecisionGraphType } from "@gorules/jdm-editor";
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const identity = (v: unknown) => (object(v) ? (v["id"] ?? v["_id"]) : undefined);
const known = new Set([
  "nodes",
  "edges",
  "id",
  "_id",
  "_description",
  "name",
  "description",
  "type",
  "content",
  "position",
  "x",
  "y",
  "sourceId",
  "targetId",
  "sourceHandle",
  "targetHandle",
  "kind",
  "config",
  "hitPolicy",
  "inputs",
  "outputs",
  "rules",
  "expression",
  "statements",
  "condition",
  "field",
  "key",
  "passThrough",
  "inputField",
  "outputPath",
  "executionMode",
]);
export function writeModel(text: string, model: unknown): string {
  const document: Document = parseDocument(text, {
    schema: "core",
    uniqueKeys: true,
  });
  if (document.errors.length) throw new Error(document.errors[0]!.message);
  const original: unknown = document.toJS();
  if (equal(original, model)) return text;
  const fields = new Set(known);
  if (object(original) && Array.isArray(original["nodes"]))
    for (const node of original["nodes"])
      if (object(node) && object(node["content"]) && object(node["content"]["config"]))
        for (const key of ["inputs", "outputs"])
          for (const column of Array.isArray(node["content"]["config"][key])
            ? node["content"]["config"][key]
            : [])
            if (object(column) && typeof column["id"] === "string") fields.add(column["id"]);
  function update(node: Node | null | undefined, value: unknown, doc: Document): Node {
    if (equal(node?.toJSON(), value)) return node!;
    if (isMap(node) && object(value)) {
      for (const pair of node.items.toReversed())
        if (
          isScalar(pair.key) &&
          typeof pair.key.value === "string" &&
          (!(pair.key.value in value) || value[pair.key.value] === undefined) &&
          fields.has(pair.key.value)
        )
          node.delete(pair.key.value);
      for (const [key, child] of Object.entries(value))
        if (child !== undefined)
          node.set(key, update(node.get(key, true) as Node | undefined, child, doc));
      return node;
    }
    if (isSeq<Node>(node) && Array.isArray(value)) {
      const old = node.items;
      const byId = new Map(old.map((item) => [identity(item?.toJSON()), item]));
      if (
        value.every((v) => identity(v) !== undefined) &&
        old.every((v) => identity(v?.toJSON()) !== undefined)
      )
        node.items = value.map((v) => update(byId.get(identity(v)) as Node | undefined, v, doc));
      else node.items = value.map((v, i) => update(old[i] as Node | undefined, v, doc));
      return node;
    }
    if (isScalar(node) && !object(value) && !Array.isArray(value)) {
      node.value = value;
      return node;
    }
    return doc.createNode(value);
  }
  document.contents = update(document.contents, model, document);
  return document.toString();
}
export function prepareModel(value: unknown) {
  if (!object(value) || !Array.isArray(value["nodes"]) || !Array.isArray(value["edges"]))
    throw new TypeError("Expected a decision model graph.");
  const filled = new Map<string, { name?: string; position?: { x: number; y: number } }>();
  const nodes = value["nodes"].map((v, index) => {
    if (!object(v) || typeof v["id"] !== "string") throw new TypeError("Expected a node id.");
    const defaults = {
      ...(v["name"] === undefined ? { name: v["id"] } : {}),
      ...(v["position"] === undefined ? { position: { x: index * 250, y: 0 } } : {}),
    };
    filled.set(v["id"], defaults);
    return { ...defaults, ...v };
  });
  const model = { ...value, nodes } as unknown as DecisionGraphType;
  return {
    model,
    authored(edited: DecisionGraphType) {
      return {
        ...edited,
        nodes: edited.nodes.map((node) => {
          const result = { ...node } as Record<string, unknown>,
            defaults = filled.get(node.id);
          if (defaults?.name !== undefined && result["name"] === defaults.name)
            delete result["name"];
          if (defaults?.position !== undefined && equal(result["position"], defaults.position))
            delete result["position"];
          return result;
        }),
      };
    },
  };
}
