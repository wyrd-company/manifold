// ---
// relationships:
//   implements: blueprint-loader
// ---
import type { ImplementationRegistry } from "./blueprint-loader/index.ts";
export const serviceImplementations: ImplementationRegistry = {
  actors: {},
  actions: {},
  guards: {},
  delays: {},
};
