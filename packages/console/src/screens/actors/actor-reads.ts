// ---
// relationships:
//   implements: operator-console
// ---
import { useQuery } from "@tanstack/react-query";
import { fetchActorHistory, fetchActorUsage } from "../../api/client.ts";
import { fetchTask } from "../../api/tasks.ts";
export const actorReadOptions = {
  staleTime: 0,
  refetchOnWindowFocus: "always" as const,
  refetchOnMount: "always" as const,
  retry: false,
};
export const historyQuery = (actorId: string) => ({
  queryKey: ["actor-history", actorId],
  queryFn: () => fetchActorHistory(actorId),
  ...actorReadOptions,
});
export const usageQuery = (actorId: string) => ({
  queryKey: ["actor-usage", actorId],
  queryFn: () => fetchActorUsage(actorId),
  ...actorReadOptions,
});
export const taskQuery = (actorId: string) => ({
  queryKey: ["task", actorId],
  queryFn: () => fetchTask(actorId),
  enabled: actorId.startsWith("task:"),
  ...actorReadOptions,
});
export function useActorReads(actorId: string) {
  const history = useQuery(historyQuery(actorId)),
    usage = useQuery(usageQuery(actorId)),
    task = useQuery(taskQuery(actorId));
  const input =
    history.data?.kind === "ok"
      ? {
          history: history.data.history,
          usage: usage.data?.kind === "ok" ? usage.data.usage : undefined,
          escalations:
            task.data?.kind === "ok"
              ? [...task.data.task.escalations.open, ...task.data.task.escalations.recent]
              : [],
          held: task.data?.kind === "ok" && task.data.task.actor?.status === "held",
          now: history.dataUpdatedAt,
        }
      : undefined;
  return { history, usage, task, input };
}
