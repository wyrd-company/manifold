// ---
// relationships:
//   implements: [retention, service-assembly]
// ---
import { openRetention } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
export const retention = wiringPart({
  name: "retention",
  start(
    members: Pick<Service, "store" | "history" | "escalations" | "configuration" | "log">,
    context,
  ) {
    const retention = openRetention({
      store: members.store,
      history: members.history,
      escalations: members.escalations,
      configuration: members.configuration.retention,
      log: members.log,
      ...(context.options.probes?.retention ? { probe: context.options.probes.retention } : {}),
    });
    context.onStop("timers", () => retention.stop());
    retention.start();
    return { retention };
  },
});
