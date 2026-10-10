// ---
// relationships:
//   implements: service-assembly
// ---
import type { TrackedIssueIndex } from "../github-source/index.ts";
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
  ) => {
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
    let tracked: TrackedIssueIndex = new Map();
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
      github: {
        trackedIssues: () => {
          tracked = github.trackedIssueIndex();
          return [...tracked.values()];
        },
      },
      taskFields: (binding, issue) => {
        const metadata = taskMetadata.current()?.projects[binding],
          snapshot = tracked.get(issue.issue.nodeId);
        if (!metadata || !snapshot) return [];
        const values = taskMetadata.values(binding, snapshot) ?? {};
        return Object.entries(metadata.fields).map(([name, field]) => {
          const storage = field.storage;
          const where =
            storage.kind === "project-field"
              ? `Project field ${storage.name}`
              : storage.kind === "issue-field"
                ? `${storage.organization} issue field ${storage.name}`
                : storage.kind === "issue-type"
                  ? `${storage.organization} issue type`
                  : storage.kind === "label"
                    ? `Label ${storage.prefix}<option>`
                    : storage.kind === "milestone"
                      ? "Repository milestone"
                      : `Front matter ${storage.key}`;
          return {
            name,
            type: field.type,
            storage: storage.kind,
            where,
            value: values[name] ?? {
              state: "unavailable" as const,
              detail: "Task value has not been read",
            },
          };
        });
      },
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
    return { tasks };
  },
});
