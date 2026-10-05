// ---
// relationships:
//   implements: service-assembly
// ---
import { bundle } from "../bundle/index.ts";
import { mountBlueprintsApi } from "./index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
export const blueprintsApi = wiringPart({
  name: "blueprints-api",
  start: (
    members: Required<
      Pick<Service, "revisions" | "processRepository" | "store" | "configuration" | "log">
    > & { http: HttpHost },
  ): Record<never, never> => {
    const { http, revisions, processRepository, store, configuration, log } = members;
    mountBlueprintsApi(http, {
      revisions,
      processRepository,
      store,
      repository: {
        url: configuration.processRepository.url,
        branch: configuration.processRepository.branch,
      },
      configurationBound: configuration.blueprintLint.configurationBound,
      bundle,
      log: (entry) =>
        log({
          level: entry.level,
          event: "blueprints-api-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    return {};
  },
});
