// ---
// relationships:
//   implements: task-metadata
// ---
import { isMap, isScalar, isNode, parseDocument, Document, Scalar, visit } from "yaml";
export type FrontMatter =
  | { readonly state: "absent" }
  | { readonly state: "invalid"; readonly message: string }
  | {
      readonly state: "present";
      readonly values: Readonly<Record<string, unknown>>;
      readonly range: readonly [number, number];
      readonly rest: string;
    };
function block(body: string) {
  const start = /^---\r?\n/.exec(body);
  if (!start) return;
  const close = /^---(?:\r?\n|$)/gm;
  close.lastIndex = start[0].length;
  const end = close.exec(body);
  if (!end)
    return {
      text: body.slice(start[0].length),
      end: body.length,
      eol: start[0].includes("\r") ? "\r\n" : "\n",
      closed: false,
    };
  return {
    text: body.slice(start[0].length, end.index),
    end: end.index + end[0].length,
    eol: start[0].includes("\r") ? "\r\n" : "\n",
    closed: true,
  };
}
function document(text: string) {
  const doc = parseDocument(text, {
    version: "1.2",
    schema: "core",
    uniqueKeys: true,
    customTags: [],
  });
  if (
    doc.errors.length ||
    doc.warnings.length ||
    doc.directives.yaml.version !== "1.2" ||
    (doc.contents !== null && !isMap(doc.contents))
  )
    throw new Error(
      doc.errors[0]?.message ??
        doc.warnings[0]?.message ??
        "Front matter must be a YAML 1.2 mapping",
    );
  return doc;
}
export function parseFrontMatter(body: string): FrontMatter {
  const found = block(body);
  if (!found) return { state: "absent" };
  try {
    if (!found.closed) throw new Error("Unclosed front matter");
    const doc = document(found.text);
    return {
      state: "present",
      values: (doc.toJS() ?? {}) as Record<string, unknown>,
      range: [0, found.end],
      rest: body.slice(found.end),
    };
  } catch (error) {
    return { state: "invalid", message: error instanceof Error ? error.message : String(error) };
  }
}
function nodeComments(nodes: readonly unknown[]) {
  const comments: string[] = [];
  for (const node of nodes)
    if (isNode(node))
      visit(node, (_key, node) => {
        if (isNode(node) && node.commentBefore) comments.push(node.commentBefore);
        if (isNode(node) && node.comment) comments.push(node.comment);
      });
  return comments;
}
export function setFrontMatter(body: string, key: string, value: string | number | null): string {
  const parsed = parseFrontMatter(body);
  if (parsed.state === "invalid") throw new Error(`front-matter-invalid: ${parsed.message}`);
  if (parsed.state === "absent" && value === null) return body;
  const found = block(body);
  const doc = found ? document(found.text) : new Document();
  if (value === null) {
    if (!doc.has(key)) return body;
    if (isMap(doc.contents)) {
      const pair = doc.contents.items.find((pair) => isScalar(pair.key) && pair.key.value === key);
      const comments = nodeComments([pair?.key, pair?.value]);
      if (comments.length)
        doc.comment = [...comments, ...(doc.comment ? [doc.comment] : [])].join("\n");
    }
    doc.delete(key);
  } else {
    if (doc.get(key) === value) return body;
    const scalar = new Scalar(value);
    const previous = doc.get(key, true);
    if (isScalar(previous)) {
      if (previous.comment !== undefined) scalar.comment = previous.comment;
      if (previous.commentBefore !== undefined) scalar.commentBefore = previous.commentBefore;
      if (previous.spaceBefore !== undefined) scalar.spaceBefore = previous.spaceBefore;
      if (
        typeof value === "string" &&
        (previous.type === Scalar.QUOTE_SINGLE || previous.type === Scalar.QUOTE_DOUBLE)
      )
        scalar.type = previous.type;
    } else {
      const comments = nodeComments([previous]);
      if (comments.length) scalar.commentBefore = comments.join("\n");
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
      scalar.type = Scalar.QUOTE_DOUBLE;
    doc.set(key, scalar);
  }
  const text = doc.toString({ lineWidth: 0 });
  const rest = found ? body.slice(found.end) : body;
  if (
    isMap(doc.contents) &&
    !doc.contents.items.length &&
    !doc.comment &&
    !doc.commentBefore &&
    !doc.contents.comment &&
    !doc.contents.commentBefore
  )
    return rest.replace(/^\r?\n/, "");
  const eol = found?.eol ?? "\n";
  const yaml = text.replace(/\r?\n/g, eol);
  return `---${eol}${yaml}---${eol}${found ? rest : rest ? eol + rest : ""}`;
}
