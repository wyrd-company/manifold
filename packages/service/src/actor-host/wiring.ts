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
    const actorHost = await (options.actorHost ?? createServiceActorHost)({
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
    });
    return { actorHost };
  },
});
