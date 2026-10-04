// ---
// relationships:
//   implements: actor-host
// ---
import type { SaveHook } from "./actor-host/index.ts";
/** Structural parts until service assembly lands; providers add their hooks here. */
export interface ServiceSaveHookParts {
  readonly saveHooks?: readonly SaveHook[];
}
export function serviceSaveHooks(parts: ServiceSaveHookParts): readonly SaveHook[] {
  return parts.saveHooks ?? [];
}
