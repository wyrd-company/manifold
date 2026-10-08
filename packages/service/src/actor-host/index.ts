// ---
// relationships:
//   implements: actor-host
// ---
export { validateInput as validateActorInput } from "./identity.ts";
export { openActorHost } from "./host.ts";
export { recordStateEntry, invocationOf } from "./records.ts";
export { ActorStartError } from "./types.ts";
export type {
  ActorHostOptions,
  ActorHost,
  ActorStart,
  Invocation,
  SaveHook,
  ActorSave,
  StateChange,
  ActiveInvoke,
} from "./types.ts";
