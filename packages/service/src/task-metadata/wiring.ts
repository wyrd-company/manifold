// ---
// relationships:
//   implements: service-assembly
// ---
import { openTaskMetadata } from "./index.ts";
import { invocationOf } from "../actor-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import { actorHost as actorHostPart } from "../actor-host/wiring.ts";
import { revisions as revisionsPart } from "../service/revisions-wiring.ts";
import type { HttpHost } from "../http-host/index.ts";
import { githubSource } from "../github-source/wiring.ts";
export const taskMetadata = wiringPart({
  name: "task-metadata",
  start: (
    members: Required<Pick<Service, "store" | "portfolio" | "processRepository">> & {
      http: HttpHost;
    },
    context,
  ): { taskMetadata: ReturnType<typeof openTaskMetadata> } => {
    const { store, portfolio, processRepository, http } = members;
    const revisions = context.later(revisionsPart);
    const actorHost = context.later(actorHostPart);
    const source = context.later(githubSource);
    const taskMetadata = openTaskMetadata({
      connection: store.connection,
      actorOf: (id) => actorHost.current()?.actorHost.actorOf(id),
      invocationOf,
      bindingOf: (project) => portfolio.githubProject(project)?.binding,
      source: async (signal) => (await source.ready(signal)).github,
      revisions: { save: (request) => revisions.get().revisions.save(request) },
      revisionAt: processRepository.revisionAt,
      bindings: () =>
        portfolio
          .current()
          .declaration.githubProjects.filter((binding) => !binding.archived)
          .map((binding) => ({
            binding: binding.name,
            owner: binding.owner,
            number: binding.number,
            portfolioItem: binding.item,
            environment: binding.environment,
          })),
    });
    context.addImplementations(taskMetadata.implementations);
    http.mount("/api/projects", taskMetadata.requestListener);
    context.onStop("requests", taskMetadata.close);
    return { taskMetadata };
  },
});
