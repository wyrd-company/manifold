// ---
// relationships:
//   implements: service-assembly
// ---
import { openBundles } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
export const bundles = wiringPart({
  name: "bundles",
  start: (
    members: Required<Pick<Service, "store">>,
  ): { bundles: ReturnType<typeof openBundles> } => {
    const { store } = members;
    const bundles = openBundles({ store });
    return { bundles };
  },
});
