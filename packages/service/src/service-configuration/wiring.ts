// ---
// relationships:
//   implements: service-assembly
// ---
import { loadServiceConfiguration } from "./index.ts";
import { configureBlueprintExpressions } from "../blueprint-expressions.ts";
import { wiringPart } from "../service/wiring.ts";
import type { ServiceConfiguration } from "./index.ts";
export const configuration = wiringPart({
  name: "configuration",
  start: async (_members: object, context): Promise<{ configuration: ServiceConfiguration }> => {
    const { options } = context;
    const configuration = await loadServiceConfiguration(options.configurationFile);
    configureBlueprintExpressions(configuration.expressions);
    return { configuration };
  },
});
