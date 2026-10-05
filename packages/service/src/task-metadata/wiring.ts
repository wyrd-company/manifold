// ---
// relationships:
//   implements: service-assembly
// ---
import { openTaskMetadata } from "./index.ts";
import { invocationOf } from "../actor-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
import { actorHost as actorHostPart } from "../actor-host/wiring.ts";
import { githubSource } from "../github-source/wiring.ts";
export const taskMetadata = wiringPart({
  name: "task-metadata",
  start: (
    members: Required<Pick<Service, "store" | "portfolio">>,
    context,
  ): { taskMetadata: ReturnType<typeof openTaskMetadata> } => {
    const { store, portfolio } = members;
    const actorHost = context.later(actorHostPart);
    const source = context.later(githubSource);
    const taskMetadata = openTaskMetadata({
      connection: store.connection,
      actorOf: (id) => actorHost.current()?.actorHost.actorOf(id),
      invocationOf,
      bindingOf: (project) => portfolio.githubProject(project)?.binding,
      source: async (signal) => (await source.ready(signal)).github,
    });
    context.addImplementations(taskMetadata.implementations);
    return { taskMetadata };
  },
});
