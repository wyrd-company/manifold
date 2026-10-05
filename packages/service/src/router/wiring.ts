// ---
// relationships:
//   implements: service-assembly
// ---
import { startRouter } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { Router } from "./index.ts";
export const router = wiringPart({
  name: "router",
  start: (
    members: Required<Pick<Service, "store" | "actorHost" | "gates" | "escalations" | "log">>,
    context,
  ): { router: Router } => {
    const { store, actorHost, gates, escalations, log } = members;
    const router = startRouter({
      store,
      host: actorHost,
      ...(gates ? { afterDrain: gates.afterDrain } : {}),
      onHeld: (held) => {
        log({
          level: "warn",
          event: "actor-held",
          message: held.reason,
          detail: { actorId: held.actorId },
        });
        escalations.raise({
          kind: "held-actor",
          subject: { actorId: held.actorId },
          question: `Actor ${held.actorId} is held: ${held.reason}${held.row ? ` (event ${held.row.eventId})` : ""}`,
          choices: [
            { id: "retry", label: "Retry" },
            { id: "dismiss", label: "Dismiss" },
          ],
        });
      },
    });
    context.onStop("delivery", () => router.stop());
    return { router };
  },
});
