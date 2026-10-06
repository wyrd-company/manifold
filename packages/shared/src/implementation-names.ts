// ---
// relationships:
//   implements: blueprint-loader
// ---
import { manifoldImplementationCatalog } from "./implementation-catalog.ts";
import type { ImplementationKind } from "./implementation-catalog.ts";
import { agentToolsSchema } from "./agent-tools-schema.ts";
export interface ImplementationNames {
  readonly actors: ReadonlySet<string>;
  readonly actions: ReadonlySet<string>;
  readonly guards: ReadonlySet<string>;
  readonly raises?: ReadonlyMap<string, readonly string[]>;
  readonly events?: ReadonlySet<string>;
  readonly delays: ReadonlySet<string>;
}
const names = (kind: ImplementationKind) =>
  new Set(
    manifoldImplementationCatalog.filter((entry) => entry.kind === kind).map((entry) => entry.name),
  );
export const manifoldImplementationNames: ImplementationNames = {
  actors: names("actor"),
  actions: names("action"),
  guards: names("guard"),
  delays: names("delay"),
  raises: new Map(
    manifoldImplementationCatalog.flatMap((entry) =>
      entry.raises ? [[entry.name, entry.raises] as const] : [],
    ),
  ),
  events: new Set([
    agentToolsSchema.$defs["agent-handoff-event"].properties.type.const,
    agentToolsSchema.$defs["agent-escalated-event"].properties.type.const,
    agentToolsSchema.$defs["agent-escalation-answered-event"].properties.type.const,
    agentToolsSchema.$defs["agent-message-event"].properties.type.const,
  ]),
};
