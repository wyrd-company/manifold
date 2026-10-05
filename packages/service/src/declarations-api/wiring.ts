// ---
// relationships:
//   implements: [declarations-api, service-assembly]
// ---
import { mountDeclarationsApi } from "./index.ts";
import type { DeclarationsApiOptions, DeclarationImpact } from "./types.ts";
import type { ServiceConfiguration } from "../service-configuration/index.ts";
import type { HttpHost } from "../http-host/index.ts";
import type { T3CodeSource } from "../t3code-source/index.ts";
import type { TaskMetadata } from "../task-metadata/index.ts";
import type { ServiceLogEntry } from "../service/types.ts";
// Structural wiring part until the service wiring parts and planner merge.
export const declarationsApiPart = {
  name: "declarations-api",
  start(
    members: {
      http: HttpHost;
      revisions: DeclarationsApiOptions["revisions"];
      processRepository: DeclarationsApiOptions["processRepository"];
      configuration: ServiceConfiguration;
      t3code: T3CodeSource;
      taskMetadata: TaskMetadata;
      log: (entry: ServiceLogEntry) => void;
    },
    _context?: unknown,
  ) {
    const planner = members.taskMetadata as TaskMetadata & {
      planDeclaration?: DeclarationsApiOptions["planDeclaration"];
    };
    mountDeclarationsApi(members.http, {
      revisions: members.revisions,
      processRepository: members.processRepository,
      repository: {
        url: members.configuration.processRepository.url,
        branch: members.configuration.processRepository.branch,
      },
      environments: Object.keys(members.configuration.environments),
      t3codeProjects: members.t3code.projects,
      planDeclaration: (declaration) =>
        planner.planDeclaration?.(declaration) ?? ([] as readonly DeclarationImpact[]),
      log: (entry) =>
        members.log({
          level: entry.level,
          event: "declarations-api-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
  },
};
