// ---
// relationships:
//   implements: blueprint-migration
// ---
import type { BlueprintVersion } from "@wyrd-company/manifold-shared";
export function laterVersion(
  from: BlueprintVersion,
  to: BlueprintVersion,
  facts: { ancestor: boolean; fromBundle?: number; toBundle?: number },
) {
  if (from.path !== to.path) return false;
  if (from.commit !== to.commit) return facts.ancestor;
  return (
    !!from.bundle &&
    !!to.bundle &&
    facts.fromBundle !== undefined &&
    facts.toBundle !== undefined &&
    facts.toBundle > facts.fromBundle
  );
}
