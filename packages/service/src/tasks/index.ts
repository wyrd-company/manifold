// ---
// relationships:
//   implements: [tasks-api, operator-console]
// ---
import { tasksApiPath } from "@wyrd-company/manifold-shared/tasks-api";
import { boardProjects, taskDetail } from "./tasks.ts";
import type { Tasks, TasksOptions } from "./types.ts";
export type {
  Tasks,
  TasksOptions,
  TasksBoundProject,
  TasksGitHub,
  TasksActorUsage,
  TasksEscalation,
  TasksThreadView,
} from "./types.ts";
export function openTasks(options: TasksOptions): Tasks {
  const reads = () => ({
    projects: options.boundProjects(),
    tracked: options.github.trackedIssueIds().flatMap((id) => {
      const issue = options.github.trackedIssue(id);
      return issue ? [issue] : [];
    }),
    escalations: options.listEscalations({}),
  });
  const tasks: Tasks = {
    list() {
      const { projects, tracked, escalations } = reads();
      return boardProjects(
        projects,
        tracked,
        new Map(
          tracked.map((t) => {
            const id = `task:${t.issue.nodeId}`;
            return [id, options.store.loadSnapshot(id)];
          }),
        ),
        escalations,
        options.held,
        options.tokenHolder,
      );
    },
    get(actorId) {
      if (!/^task:.+$/.test(actorId)) return undefined;
      const { projects, tracked, escalations } = reads();
      const issue = tracked.find((t) => `task:${t.issue.nodeId}` === actorId);
      if (!issue) return undefined;
      const task = taskDetail(
        actorId,
        issue,
        projects,
        options.store.loadSnapshot(actorId),
        escalations,
        options,
      );
      return task ? { task } : undefined;
    },
    requestListener(request, response) {
      const path = request.url?.split("?")[0] ?? "";
      if (request.method !== "GET") {
        response.writeHead(405, { Allow: "GET" }).end();
        return;
      }
      response.setHeader("Cache-Control", "no-store");
      let actorId: string | undefined;
      if (path !== tasksApiPath) {
        const segment = path.slice(tasksApiPath.length + 1);
        if (!path.startsWith(tasksApiPath + "/") || !segment || segment.includes("/")) {
          response.writeHead(404).end();
          return;
        }
        try {
          actorId = decodeURIComponent(segment);
        } catch {
          response.writeHead(404).end();
          return;
        }
      }
      try {
        const result = actorId === undefined ? tasks.list() : tasks.get(actorId);
        if (!result) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
      } catch (error) {
        (options.log ?? ((entry) => console.error(JSON.stringify(entry))))({
          level: "error",
          path,
          error: error instanceof Error ? error.message : String(error),
        });
        response.writeHead(500).end();
      }
    },
  };
  return tasks;
}
