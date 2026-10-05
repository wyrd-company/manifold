// ---
// relationships:
//   implements: service-assembly
// ---
import { openProcessRepository } from "./index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { ProcessRepository } from "./index.ts";
export const processRepository = wiringPart({
  name: "process-repository",
  start: async (
    members: Required<Pick<Service, "configuration">>,
    context,
  ): Promise<{ processRepository: ProcessRepository }> => {
    const { configuration } = members;
    const { options } = context;
    const processRepository = await openProcessRepository({
      configuration: configuration.processRepository,
      credentials: configuration.credentials,
      ...(options.probes?.pull ? { probe: options.probes.pull } : {}),
      ...(options.probes?.save ? { saveProbe: options.probes.save } : {}),
    });
    return { processRepository };
  },
});
