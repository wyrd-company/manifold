// ---
// relationships:
//   implements: actor-host
// ---
import type { SaveHook } from "./actor-host/index.ts";
import type { ServiceParts } from "./service/index.ts";
/** Providers add their hooks here, in registration order. */
export function serviceSaveHooks(parts: Omit<ServiceParts, "actorHost">): readonly SaveHook[] {
  return [parts.usage.saveHook, parts.escalations.saving];
}
