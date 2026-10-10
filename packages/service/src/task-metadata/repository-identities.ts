// ---
// relationships:
//   implements: task-metadata
// ---
import type { ScopeInput } from "./project-types.ts";
/** Name matches win; equal unmatched lists retain their applied identities in declaration order. */
export function repositoryIdentities(input: ScopeInput): Readonly<Record<string, string>> {
  const identities = { ...input.applied?.owned };
  if (input.observed?.status !== "ready") return identities;
  for (const storage of ["label", "milestone"] as const) {
    const current = input.owned.entities.filter((e) => e.storage === storage);
    const observations =
      storage === "label"
        ? input.observed.labels.map((l) => ({ id: l.nodeId, name: l.name.toLowerCase() }))
        : input.observed.milestones.map((m) => ({ id: m.nodeId, name: m.title }));
    const keys = new Set(current.map((e) => e.key));
    const next = current.filter(
      (e) =>
        !identities[e.key] &&
        !observations.some((o) => o.name === (storage === "label" ? e.name.toLowerCase() : e.name)),
    );
    const earlier = Object.entries(identities).filter(
      ([key, id]) =>
        key.startsWith(`${storage}:`) &&
        !keys.has(key) &&
        observations.some((o) => o.id === id) &&
        !current.some((e) =>
          observations.some(
            (o) => o.id === id && o.name === (storage === "label" ? e.name.toLowerCase() : e.name),
          ),
        ),
    );
    if (next.length === earlier.length)
      next.forEach((e, i) => {
        identities[e.key] = earlier[i]![1];
      });
  }
  return identities;
}
