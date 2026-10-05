// ---
// relationships:
//   implements: [blueprints-api, operator-console]
// ---
import { isMap, isSeq, isScalar, isNode, LineCounter, parseDocument } from "yaml";
import type { Node } from "yaml";
import type { BlueprintFinding } from "./blueprint-lint.ts";
import type { ApiFinding, FindingRange } from "./blueprints-api.ts";

export function findingRanges(
  text: string,
  findings: readonly BlueprintFinding[],
): readonly ApiFinding[] {
  const lines = new LineCounter();
  const document = parseDocument(text, {
    version: "1.2",
    schema: "core",
    uniqueKeys: true,
    customTags: [],
    lineCounter: lines,
  });
  const firstLine = text.indexOf("\n");
  const lineEnd = (from: number) => {
    const end = text.indexOf("\n", from);
    const to = end < 0 ? text.length : end;
    return text[to - 1] === "\r" ? to - 1 : to;
  };
  const makeRange = (from: number, to: number): FindingRange => {
    const position = lines.linePos(from);
    return { from, to, line: position.line, column: position.col };
  };
  return findings.map(({ path: _path, ...finding }) => {
    let range = makeRange(0, firstLine < 0 ? text.length : lineEnd(0));
    if (finding.kind === "yaml" && finding.line !== undefined && finding.column !== undefined) {
      const start = lines.lineStarts[finding.line - 1];
      if (start !== undefined) {
        const from = Math.min(start + finding.column - 1, lineEnd(start));
        range = makeRange(from, lineEnd(start));
      }
    } else {
      let node: Node | null = document.contents;
      for (const segment of finding.location
        .split("/")
        .slice(1)
        .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))) {
        if (isMap(node)) {
          const entry = node.items.find(
            (pair) => isScalar(pair.key) && String(pair.key.value) === segment,
          );
          if (!entry || !isScalar(entry.key)) break;
          const next = entry.value;
          if (!isNode(next) || !next.range || !entry.key.range) break;
          range = makeRange(entry.key.range[0], next.range[1]);
          node = next;
        } else if (isSeq(node) && /^(0|[1-9]\d*)$/.test(segment)) {
          const next = node.items[Number(segment)];
          if (!isNode(next) || !next.range) break;
          range = makeRange(next.range[0], next.range[1]);
          node = next;
        } else break;
      }
    }
    return { ...finding, range };
  });
}
