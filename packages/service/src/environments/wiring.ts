// ---
// relationships:
//   implements: service-assembly
// ---
import { openEnvironments } from "./index.ts";
import type { Environments } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import { t3codeSource } from "../t3code-source/wiring.ts";
export const environments = wiringPart({
  name: "environments",
  start(
    members: Required<
      Pick<Service, "configuration" | "store" | "router" | "agentThreads" | "http">
    >,
    context,
  ): { environments: Environments } {
    const source = context.later(t3codeSource);
    const environments = openEnvironments({
      store: members.store,
      router: members.router,
      environments: members.configuration.environments,
      configurationFile: members.configuration.file,
      status: () => source.current()?.t3code.status() ?? [],
      restart: (name) => source.get().t3code.restart(name),
      scheduled: members.agentThreads.scheduled,
    });
    members.http.mount("/api/environments", environments.requestListener);
    return { environments };
  },
});
