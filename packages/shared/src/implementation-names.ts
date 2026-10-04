// ---
// relationships:
//   implements: blueprint-loader
// ---
export interface ImplementationNames {
  readonly actors: ReadonlySet<string>;
  readonly actions: ReadonlySet<string>;
  readonly guards: ReadonlySet<string>;
  readonly delays: ReadonlySet<string>;
}
// Providers add their names here when their implementation joins the service registry.
export const manifoldImplementationNames: ImplementationNames = {
  actors: new Set(),
  actions: new Set(),
  guards: new Set(),
  delays: new Set(),
};
