// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { Columns3, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchTasks } from "../api/tasks.ts";
import type { BoundProject } from "@wyrd-company/manifold-shared/tasks-api";
import { Button } from "../ui/button.tsx";
import { EmptyState } from "./EmptyContent.tsx";
import { boardLanes, browserStorage, readCollapsed, writeCollapsed } from "./board/lanes.ts";
import { TaskCard } from "./board/TaskCard.tsx";
export function boardSearch(value: Record<string, unknown>): { project?: string; item?: string } {
  return {
    ...(typeof value["project"] === "string" ? { project: value["project"] } : {}),
    ...(typeof value["item"] === "string" ? { item: value["item"] } : {}),
  };
}
function BoardLanes({
  project,
  search,
}: {
  project: BoundProject;
  search: { project?: string; item?: string };
}) {
  const key = `${project.owner}/${project.number}`;
  const [collapsed, setCollapsed] = useState(() => readCollapsed(browserStorage(), key));
  function toggle(name: string) {
    const next = collapsed.includes(name)
      ? collapsed.filter((n) => n !== name)
      : [...collapsed, name];
    setCollapsed(next);
    writeCollapsed(browserStorage(), key, next);
  }
  return (
    <div className="board-lanes">
      {boardLanes(project).map((lane) => {
        const isCollapsed = collapsed.includes(lane.name);
        return (
          <section
            key={lane.name}
            className={`board-lane ${isCollapsed ? "collapsed" : ""}`}
            aria-label={`${lane.name} lane`}
          >
            <div className="lane-heading">
              <h2>{lane.name}</h2>
              <span className="lane-count">{lane.tasks.length}</span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${lane.name}`}
                onClick={() => toggle(lane.name)}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </Button>
            </div>
            {!isCollapsed ? (
              <div className="lane-cards">
                {lane.tasks.length ? (
                  lane.tasks.map((task) => (
                    <TaskCard key={task.actorId} task={task} search={search} />
                  ))
                ) : (
                  <div className="lane-empty muted">No tasks</div>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
export function BoardContent() {
  const search = useSearch({ from: "/board" }),
    navigate = useNavigate();
  const query = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    retry: false,
  });
  const result = query.data;
  if (!result) return <p role="status">Loading tasks…</p>;
  if (result.kind === "failed")
    return (
      <div role="alert" className="error-alert">
        <p>{result.message}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  const project =
    result.projects.find((p) => `${p.owner}/${p.number}` === search.project) ?? result.projects[0];
  if (!project)
    return (
      <EmptyState
        icon={Columns3}
        title="No bound Projects"
        description="Bind a GitHub Project in the process repository to see its tasks here."
      />
    );
  const filtered = {
    ...project,
    tasks: project.tasks.filter((t) => !search.item || t.portfolioItem === search.item),
  };
  const items = [
    ...new Set(project.tasks.flatMap((t) => (t.portfolioItem ? [t.portfolioItem] : []))),
  ];
  const change = (next: { project?: string; item?: string }) =>
    void navigate({ to: "/board", search: next });
  return (
    <>
      <div className="board-toolbar">
        {result.projects.length > 1 ? (
          <label>
            Project
            <select
              aria-label="Project"
              value={`${project.owner}/${project.number}`}
              onChange={(e) => change({ project: e.target.value })}
            >
              {result.projects.map((p) => (
                <option key={`${p.owner}/${p.number}`} value={`${p.owner}/${p.number}`}>
                  {p.owner} / {p.number}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label>
          Portfolio item
          <select
            aria-label="Portfolio item"
            value={search.item ?? ""}
            onChange={(e) => change({ ...search, item: e.target.value })}
          >
            <option value="">All items</option>
            {items.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        {search.item ? (
          <Button
            variant="ghost"
            onClick={() => change(search.project ? { project: search.project } : {})}
          >
            Clear filters
          </Button>
        ) : null}
        <span className="toolbar-space" />
        <span className="muted">{filtered.tasks.length} tasks</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh tasks"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {!project.lifecycle ? (
        <div className="info-alert">This Project declares no lifecycle field.</div>
      ) : null}
      <BoardLanes key={`${project.owner}/${project.number}`} project={filtered} search={search} />
    </>
  );
}
