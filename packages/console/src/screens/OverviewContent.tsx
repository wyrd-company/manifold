// ---
// relationships:
//   implements: operator-console
// ---
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { fetchActors } from "../api/client.ts";
import { fetchTasks, fetchTask } from "../api/tasks.ts";
import { fetchPortfolio } from "../api/portfolio.ts";
import { fetchEscalations } from "../api/escalations.ts";
import { Button } from "../ui/button.tsx";
import { fetchEnvironments } from "./overview/environments.ts";
import { activeActorRows } from "./overview/active-actors.ts";
import { needsAttention } from "./overview/attention.ts";
import { ReadAlerts } from "./overview/ReadAlerts.tsx";
import { StatTiles } from "./overview/StatTiles.tsx";
import { ActiveActorsTable } from "./overview/ActiveActorsTable.tsx";
import { NeedsAttentionList } from "./overview/NeedsAttentionList.tsx";
import { ItemBudgets } from "./overview/ItemBudgets.tsx";
const policy = {
  staleTime: 0,
  refetchOnWindowFocus: "always",
  refetchOnMount: "always",
  retry: false,
} as const;
export function OverviewContent() {
  const actorsQuery = useQuery({ queryKey: ["actors"], queryFn: fetchActors, ...policy });
  const tasksQuery = useQuery({ queryKey: ["tasks"], queryFn: fetchTasks, ...policy });
  const portfolioQuery = useQuery({ queryKey: ["portfolio"], queryFn: fetchPortfolio, ...policy });
  const escalationsQuery = useQuery({
    queryKey: ["escalations", "open"],
    queryFn: () => fetchEscalations("open"),
    ...policy,
  });
  const environmentsQuery = useQuery({
    queryKey: ["environments"],
    queryFn: fetchEnvironments,
    ...policy,
  });
  const actors = actorsQuery.data?.kind === "ok" ? actorsQuery.data.actors : undefined;
  const tasks = tasksQuery.data?.kind === "ok" ? tasksQuery.data.projects : undefined;
  const portfolio = portfolioQuery.data?.kind === "ok" ? portfolioQuery.data.body : undefined;
  const escalations =
    escalationsQuery.data?.kind === "ok" ? escalationsQuery.data.escalations : undefined;
  const environments =
    environmentsQuery.data?.kind === "ok" ? environmentsQuery.data.environments : undefined;
  const rows = actors ? activeActorRows(actors, tasks, escalations) : undefined;
  const taskRows = (rows ?? []).slice(0, 10).filter((row) => row.task);
  const taskQueries = useQueries({
    queries: taskRows.map((row) => ({
      queryKey: ["task", row.actor.actorId],
      queryFn: () => fetchTask(row.actor.actorId),
      ...policy,
    })),
  });
  const attention = needsAttention({ actors, tasks, escalations, environments });
  const reads = [
    actorsQuery,
    tasksQuery,
    portfolioQuery,
    escalationsQuery,
    environmentsQuery,
    ...taskQueries,
  ];
  const now = Math.max(...reads.map((read) => read.dataUpdatedAt));
  return (
    <div className="overview-content">
      <div className="overview-toolbar">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh overview"
          disabled={reads.some((read) => read.isFetching)}
          onClick={() => {
            for (const read of reads) void read.refetch();
          }}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      <StatTiles
        rows={rows}
        attention={
          [tasksQuery, escalationsQuery, environmentsQuery].some(
            (query) => query.data?.kind === "ok",
          )
            ? attention
            : undefined
        }
        portfolio={portfolio}
        environments={environments}
      />
      <section aria-label="Active actors table" className="overview-panel">
        <h2>Active actors</h2>
        <ReadAlerts
          reads={{
            actors: actorsQuery,
            tasks: tasksQuery,
            portfolio: portfolioQuery,
            escalations: escalationsQuery,
            ...Object.fromEntries(
              taskQueries.map((query, index) => [taskRows[index]!.actor.actorId, query]),
            ),
          }}
        />
        <ActiveActorsTable
          rows={rows}
          portfolio={portfolio}
          tasks={taskQueries.flatMap((query) =>
            query.data?.kind === "ok" ? [query.data.task] : [],
          )}
          now={actorsQuery.dataUpdatedAt}
        />
      </section>
      <div className="overview-lower">
        <section aria-label="Needs attention list" className="overview-panel">
          <h2>Needs attention</h2>
          <ReadAlerts
            reads={{
              escalations: escalationsQuery,
              tasks: tasksQuery,
              actors: actorsQuery,
              environments: environmentsQuery,
            }}
          />
          <NeedsAttentionList items={attention} actors={actors} now={now} />
        </section>
        <section aria-label="Budget" className="overview-panel">
          <header className="overview-section-caption">
            <h2>Budget</h2>
            <Link to="/portfolio">Portfolio</Link>
          </header>
          <ReadAlerts reads={{ portfolio: portfolioQuery }} />
          <ItemBudgets read={portfolio} />
        </section>
      </div>
    </div>
  );
}
