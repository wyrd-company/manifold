// ---
// relationships:
//   implements: service-assembly
// ---
import { openTasks } from "./index.ts";
import { openTaskMetadata } from "../task-metadata/index.ts";
import type { HttpHost } from "../http-host/index.ts";
import { wiringPart } from "../service/wiring.ts";
import type { Service } from "../service/types.ts";
export const tasks = wiringPart({
  name: "tasks",
  start: (
    members: Required<
      Pick<
        Service,
        | "store"
        | "router"
        | "portfolio"
        | "github"
        | "escalations"
        | "t3code"
        | "gates"
        | "usage"
        | "log"
      >
    > & { taskMetadata: ReturnType<typeof openTaskMetadata>; http: HttpHost },
  ): Record<never, never> => {
    const {
      store,
      router,
      portfolio,
      taskMetadata,
      github,
      escalations,
      t3code,
      gates,
      usage,
      http,
      log,
    } = members;
    const tasks = openTasks({
      store: store,
      held: (actorId) => Boolean(router.held(actorId)),
      boundProjects: () =>
        portfolio
          .current()
          .declaration.githubProjects.filter((binding) => !binding.archived)
          .map((binding) => {
            const lifecycle = taskMetadata.current()?.projects[binding.name]?.lifecycle;
            return {
              binding: binding.name,
              owner: binding.owner,
              number: binding.number,
              item: binding.item,
              ...(lifecycle ? { lifecycle } : {}),
            };
          }),
      github,
      actorUsage: usage.actorUsage,
      accountUnit: (account) => usage.accounts()[account]?.unit,
      listEscalations: escalations.list,
      thread: t3code.thread,
      tokenHolder: gates.tokenHolder,
      log: (entry) =>
        log({
          level: entry.level,
          event: "tasks-read-failed",
          message: entry.error,
          detail: { path: entry.path },
        }),
    });
    http.mount("/api/tasks", tasks.requestListener);
    return {};
  },
});
