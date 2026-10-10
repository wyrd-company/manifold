// ---
// relationships:
//   implements: service-assembly
// ---
import { lintTokens, manifoldImplementationNames } from "@wyrd-company/manifold-shared";
import { createComparatorSandbox } from "../comparator-sandbox/index.ts";
import { createGates } from "./index.ts";
import { createMirror, trackedIssueIndex } from "../github-source/mirror.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import type { Gates } from "./index.ts";
export const gates = wiringPart({
  name: "gates",
  start: async (
    members: Required<
      Pick<
        Service,
        | "configuration"
        | "store"
        | "portfolio"
        | "processRepository"
        | "blueprints"
        | "escalations"
        | "log"
      >
    > & { githubMirror: ReturnType<typeof createMirror> },
    context,
  ): Promise<{ gates: Gates }> => {
    const {
      configuration,
      store,
      portfolio,
      processRepository,
      blueprints,
      githubMirror,
      escalations,
      log,
    } = members;
    const { options } = context;
    const gates = options.gates
      ? await options.gates({ configuration, store, portfolio, processRepository, blueprints, log })
      : createGates({
          store,
          portfolio,
          escalations,
          version: blueprints.version,
          revisionAt: processRepository.revisionAt,
          sandbox: await createComparatorSandbox(configuration.comparatorSandbox),
          lintTokens: (document) =>
            lintTokens(document, {
              names: manifoldImplementationNames,
              configurationBound: configuration.blueprintLint.configurationBound,
            }),
          trackedIssueIndex: () => {
            const state = githubMirror.read();
            return trackedIssueIndex(
              state,
              new Map(
                [...state.projects.values()]
                  .filter((row) => portfolio.githubProject(row.project))
                  .map((row) => [row.project.nodeId, row.project]),
              ),
            );
          },
          onError: (error) => log({ level: "error", event: "gate-error", message: error.message }),
        });
    context.onStop("timers", () => gates.stop());
    return { gates };
  },
});

export const gatesPrepare = wiringPart({
  name: "gates-prepare",
  start: async (members: Required<Pick<Service, "gates">>): Promise<Record<never, never>> => {
    const { gates } = members;
    await gates?.prepare();
    return {};
  },
});
