// ---
// relationships:
//   implements: operator-console
// ---
import { PanelLeft, Workflow, ChevronRight } from "lucide-react";
import { useQuery, skipToken } from "@tanstack/react-query";
import type { TaskResult } from "../api/tasks.ts";
import { epicsSearch } from "../screens/EpicsContent.tsx";
import { boardSearch } from "../screens/BoardContent.tsx";
import { Link, useParams, useSearch, useLocation } from "@tanstack/react-router";
import { Button } from "../ui/button.tsx";
import { navigation, settingsTabs } from "./navigation.ts";
import { ThemeToggle } from "./ThemeToggle.tsx";
import { CommandSearch } from "./CommandSearch.tsx";
export function Header({ toggleSidebar }: { toggleSidebar: () => void }) {
  const path = useLocation({
    select: (location) => location.pathname.replace(/^\/console/, "") || "/",
  });
  const current = navigation.find(
    (item) => item.path === path || (item.path !== "/" && path.startsWith(item.path + "/")),
  );
  const params = useParams({ strict: false });
  const blueprintPath = current?.label === "Blueprints" ? params._splat : undefined;
  const tab = settingsTabs.find((item) => item.path === path);
  const { actorId } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const task = useQuery<TaskResult>({ queryKey: ["task", actorId], queryFn: skipToken }).data;
  const issue = task?.kind === "ok" ? task.task.issue : undefined;
  return (
    <header>
      <Button variant="ghost" size="icon" aria-label="Toggle sidebar" onClick={toggleSidebar}>
        <PanelLeft />
      </Button>
      <div className="brand">
        <Workflow size={19} />
        <span>Manifold</span>
      </div>
      <div className="breadcrumb">
        <ChevronRight size={14} />
        {actorId && path.startsWith("/actors/") ? (
          <>
            <Link to="/actors">Actors</Link>
            <ChevronRight size={14} />
            <span className="mono">
              {issue ? `${issue.repository}#${issue.number}` : actorId} actor
            </span>
          </>
        ) : actorId ? (
          <>
            <Link
              to={path.startsWith("/epics/") ? "/epics" : "/board"}
              search={path.startsWith("/epics/") ? epicsSearch(search) : boardSearch(search)}
            >
              {path.startsWith("/epics/") ? "Epics" : "Board"}
            </Link>
            <ChevronRight size={14} />
            <span className="mono">{issue ? `${issue.repository}#${issue.number}` : actorId}</span>
          </>
        ) : (
          <span>{current?.label ?? "Page not found"}</span>
        )}
        {blueprintPath ? (
          <>
            <ChevronRight size={14} />
            <span className="mono">{blueprintPath}</span>
          </>
        ) : null}
        {params.binding ? (
          <>
            <ChevronRight size={14} />
            <span className="mono">{params.binding}</span>
          </>
        ) : null}
        {tab ? (
          <>
            <ChevronRight size={14} />
            <span>{tab.label}</span>
          </>
        ) : null}
      </div>
      <div className="header-space" />
      <CommandSearch />
      <ThemeToggle />
    </header>
  );
}
