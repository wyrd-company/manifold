// ---
// relationships:
//   implements: retention
// ---
import type { Escalation } from "../escalations/index.ts";
export function protections(escalations: readonly Escalation[]) {
  const actors = new Set<string>(),
    gates = new Set<string>();
  for (const { raiser } of escalations) {
    if (raiser.type === "blueprint") actors.add(raiser.actorId);
    else {
      if (raiser.subject["actorId"]) actors.add(raiser.subject["actorId"]);
      if (
        (raiser.kind === "comparator-failed" || raiser.kind === "stranded-token") &&
        raiser.subject["gate"]
      )
        gates.add(raiser.subject["gate"]);
    }
  }
  return { actors, gates };
}
