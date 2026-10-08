// ---
// relationships:
//   implements: [actor-history, service-assembly]
// ---
import { openHistory } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
export const history = wiringPart({
  name: "history",
  start: (members: Pick<Service, "store" | "log">) => ({
    history: openHistory({ store: members.store, log: members.log }),
  }),
});
