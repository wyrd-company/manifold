// ---
// relationships:
//   implements: [declarations-api, service-assembly]
// ---
import {
  lintBlueprint,
  lintTaskMetadataDeclaration,
  declaredLifecycleOptions,
  manifoldImplementationNames,
} from "@wyrd-company/manifold-shared";
import { createDecisionModels } from "../decision-models.ts";
import { mountDeclarationsApi } from "./index.ts";
import type { DeclarationsApiOptions } from "./types.ts";
import { wiringPart } from "../service/wiring.ts";
import type { ServiceConfiguration } from "../service-configuration/index.ts";
import type { HttpHost } from "../http-host/index.ts";
import type { T3CodeSource } from "../t3code-source/index.ts";
import type { TaskMetadata } from "../task-metadata/index.ts";
import type { ServiceLogEntry } from "../service/types.ts";
export const declarationsApiPart = wiringPart({
  name: "declarations-api",
  start(
    members: {
      http: HttpHost;
      revisions: DeclarationsApiOptions["revisions"];
      processRepository: DeclarationsApiOptions["processRepository"];
      configuration: ServiceConfiguration;
      t3code: T3CodeSource;
      portfolio: import("../portfolio/types.ts").Portfolio;
      taskMetadata: TaskMetadata;
      log: (entry: ServiceLogEntry) => void;
    },
    _context,
  ): Record<never, never> {
    mountDeclarationsApi(members.http, {
      createDecisionModels,
      lintBlueprint: async (path, text, decisionModels, revision) => {
        const metadata = lintTaskMetadataDeclaration({
          taskMetadata: await revision.read("task-metadata.yml"),
          bindings: await revision.read("bindings.yml"),
        });
        return lintBlueprint(path, text, manifoldImplementationNames, {
          configurationBound: members.configuration.blueprintLint.configurationBound,
          decisionModels,
          ...(metadata.ok
            ? { lifecycleOptions: declaredLifecycleOptions(metadata.declaration) }
            : {}),
        });
      },
      revisions: members.revisions,
      createdProjects: members.portfolio.createdProjects,
      processRepository: members.processRepository,
      repository: {
        url: members.configuration.processRepository.url,
        branch: members.configuration.processRepository.branch,
      },
      environments: Object.keys(members.configuration.environments),
      t3codeProjects: members.t3code.projects,
      planDeclaration: members.taskMetadata.projects.planDeclaration,
      log: (entry) =>
        members.log({
          level: entry.level,
          event: "declarations-api-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    return {};
  },
});
