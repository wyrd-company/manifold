// ---
// relationships:
//   implements: blueprint
// ---
import { createHash } from "node:crypto";

export interface BlueprintVersion {
  readonly commit: string;
  readonly path: string;
  readonly bundle?: string;
}
export const blueprintVersionKey = (version: BlueprintVersion) =>
  `${version.commit}:${version.path}${version.bundle === undefined ? "" : `@${version.bundle}`}`;
export function parseBlueprintVersionKey(key: string): BlueprintVersion | undefined {
  const match = /^([0-9a-f]{40}|[0-9a-f]{64}):(blueprints\/.+\.ya?ml)(?:@([0-9a-f]{64}))?$/.exec(
    key,
  );
  return match
    ? { commit: match[1]!, path: match[2]!, ...(match[3] ? { bundle: match[3] } : {}) }
    : undefined;
}

/** SHA-256 of code point ordered UTF-8 paths and texts, each followed by U+0000. */
export function bundleDigest(files: ReadonlyMap<string, string>): string {
  const codePoints = (value: string) => Array.from(value, (char) => char.codePointAt(0)!);
  const entries = [...files].sort(([a], [b]) => {
    const left = codePoints(a),
      right = codePoints(b);
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const difference = left[i]! - right[i]!;
      if (difference) return difference;
    }
    return left.length - right.length;
  });
  const hash = createHash("sha256");
  for (const [path, text] of entries) hash.update(path).update("\0").update(text).update("\0");
  return hash.digest("hex");
}
