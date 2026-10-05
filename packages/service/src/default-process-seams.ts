// ---
// relationships:
//   references: default-process
// ---
// Structural stand-in until the card-move owner merges. Replace this module
// and the service option with the merged registry in the planned Rebase step.
import { fromPromise } from "xstate";
import type { ImplementationRegistry } from "./blueprint-loader/index.ts";
export const pendingCardMove: ImplementationRegistry = {
  actors: {
    "github-card-move": fromPromise(async () => {
      throw new Error("The github-card-move integration has not merged");
    }),
  },
  actions: {},
  guards: {},
  delays: {},
};
