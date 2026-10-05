// ---
// relationships:
//   implements: blueprint-loader
// ---
export interface ImplementationNames {
  readonly actors: ReadonlySet<string>;
  readonly actions: ReadonlySet<string>;
  readonly guards: ReadonlySet<string>;
  readonly raises?: ReadonlyMap<string, readonly string[]>;
  readonly delays: ReadonlySet<string>;
}
// Providers add their names here when their implementation joins the service registry.
export const manifoldImplementationNames: ImplementationNames = {
  actors: new Set(["github-card-move", "escalate", "thread-create", "turn-prepare", "turn-start"]),
  actions: new Set(["follow-thread"]),
  guards: new Set(),
  delays: new Set(),
  raises: new Map(),
};
