// ---
// relationships:
//   implements: actor-host
//   references: service-assembly
// ---
import { serviceSaveHooks } from "../save-hooks.ts";
import type { ServiceSaveHookParts } from "../save-hooks.ts";
import { openActorHost } from "./host.ts";
import type { ActorHostOptions } from "./types.ts";
/** Structural subset of Omit<ServiceParts, "actorHost"> until service assembly lands. */
export interface ActorHostServiceParts extends ServiceSaveHookParts {
  readonly store: ActorHostOptions["store"];
  readonly blueprints: ActorHostOptions["blueprints"];
  readonly log: ActorHostOptions["log"];
}
export function createServiceActorHost(parts: ActorHostServiceParts) {
  return openActorHost({
    store: parts.store,
    blueprints: parts.blueprints,
    log: parts.log,
    saveHooks: serviceSaveHooks(parts),
  });
}
