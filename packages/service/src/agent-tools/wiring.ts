// ---
// relationships:
//   implements: service-assembly
// ---
import { openAgentTools } from "./index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { AgentTools } from "./index.ts";
import { router as routerPart } from "../router/wiring.ts";
import { actorHost as actorHostPart } from "../actor-host/wiring.ts";
import { escalations as escalationsPart } from "../escalations/wiring.ts";
import { t3codeSource } from "../t3code-source/wiring.ts";
export const agentTools = wiringPart({
  name: "agent-tools",
  start: (
    members: Required<Pick<Service, "store" | "configuration" | "agentThreads" | "log">> & {
      http: HttpHost;
    },
    context,
  ): { agentTools: AgentTools } => {
    const { store, configuration, agentThreads, log } = members;
    const router = context.later(routerPart);
    const actorHost = context.later(actorHostPart);
    const escalations = context.later(escalationsPart);
    const source = context.later(t3codeSource);
    const agentTools = openAgentTools({
      store,
      configuration: configuration.agentTools,
      environments: new Set(Object.keys(configuration.environments)),
      router: () => router.get().router,
      actors: () => actorHost.get().actorHost,
      escalations: () => escalations.get().escalations,
      threads: agentThreads,
      sourceReady: (environment) =>
        source.current()?.t3code.status().some((status) => status.environment === environment && status.state === "following") ?? false,
      environmentId: async (environment, signal) =>
        (await source.ready()).t3code.environmentId(environment, signal),
      log,
    });
    context.onStop("commands", () => agentTools.stop());
    context.addImplementations(agentTools.implementations);
    members.http.mount("/api/agent-tools", agentTools.requestListener);
    return { agentTools };
  },
});

export const agentToolsDelivery = wiringPart({
  name: "agent-tools-delivery",
  start: (members: Required<Pick<Service, "agentTools">>): Record<never, never> => {
    const { agentTools } = members;
    agentTools!.start();
    return {};
  },
});
