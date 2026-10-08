// ---
// relationships:
//   implements: service-assembly
// ---
import { createServiceActorHost } from "./service.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { ActorHost } from "./index.ts";
export const actorHost = wiringPart({
  name: "actor-host",
  start: async (
    members: Required<
      Pick<
        Service,
        | "configuration"
        | "store"
        | "history"
        | "portfolio"
        | "usage"
        | "processRepository"
        | "blueprints"
        | "revisions"
        | "escalations"
        | "agentThreads"
        | "agentTools"
        | "gates"
        | "log"
      >
    >,
    context,
  ): Promise<{ actorHost: ActorHost }> => {
    const {
      configuration,
      store,
      history,
      portfolio,
      usage,
      processRepository,
      blueprints,
      revisions,
      escalations,
      agentThreads,
      agentTools,
      gates,
      log,
    } = members;
    const { options } = context;
    const parts = {
      configuration,
      store,
      history,
      portfolio,
      usage,
      processRepository,
      blueprints,
      revisions,
      escalations,
      agentThreads,
      agentTools,
      gates,
      log,
    };
    const actorHost = await (options.actorHost
      ? options.actorHost(parts)
      : createServiceActorHost(parts, options.probes?.migrated));
    return { actorHost };
  },
});
