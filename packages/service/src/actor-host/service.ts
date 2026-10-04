// ---
// relationships:
//   implements: actor-host
//   references: service-assembly
// ---
import { serviceSaveHooks } from "../save-hooks.ts";
import type { ServiceParts } from "../service/index.ts";
import { openActorHost } from "./host.ts";
export function createServiceActorHost(parts: Omit<ServiceParts, "actorHost">) {
  return openActorHost({
    store: parts.store,
    blueprints: parts.blueprints,
    log: parts.log,
    saveHooks: serviceSaveHooks(parts),
  });
}
