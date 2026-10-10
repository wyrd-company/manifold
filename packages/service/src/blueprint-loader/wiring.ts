// ---
// relationships:
//   implements: service-assembly
// ---
import { createBlueprintLoader } from "./index.ts";
import { recordStateEntry } from "../actor-host/index.ts";
import { openBundles } from "../bundle/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { BlueprintLoader } from "./index.ts";
import { implementationsFor } from "../service/wiring.ts";
export const blueprintLoader = wiringPart({
  name: "blueprint-loader",
  start: (
    members: Required<Pick<Service, "configuration" | "processRepository" | "log">> & {
      bundles: ReturnType<typeof openBundles>;
    },
    context,
  ): { blueprints: BlueprintLoader } => {
    const { configuration, bundles, processRepository, log } = members;
    const blueprints = createBlueprintLoader({
      bundles,
      implementations: implementationsFor(context),
      onStateEntry: recordStateEntry,
      configurationBound: configuration.blueprintLint.configurationBound,
      revisionAt: processRepository.revisionAt,
      onExpressionError: (error, version) =>
        log({
          level: "error",
          event: "expression-error",
          message: error.message,
          detail: { commit: version.commit, path: version.path },
        }),
    });
    return { blueprints };
  },
});
