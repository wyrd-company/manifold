// ---
// relationships:
//   implements: blueprint
// ---
export interface BlueprintVersion {
  readonly commit: string;
  readonly path: string;
}
export const blueprintVersionKey = (version: BlueprintVersion) =>
  `${version.commit}:${version.path}`;
export function parseBlueprintVersionKey(key: string): BlueprintVersion | undefined {
  const match = /^([0-9a-f]{40}|[0-9a-f]{64}):(blueprints\/.+\.ya?ml)$/.exec(key);
  return match ? { commit: match[1]!, path: match[2]! } : undefined;
}
