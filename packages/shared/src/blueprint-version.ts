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

/** SHA-256 of sorted [path, text] pairs serialized as UTF-8 JSON. */
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
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}
