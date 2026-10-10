// ---
// relationships:
//   implements: [operator-console, epics-api]
// ---
import { lazy, Suspense, useMemo, useState } from "react";
import { useQuery, skipToken } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { GitBranch, RefreshCw } from "lucide-react";
import { fetchEpicRoots, fetchEpic } from "../api/epics.ts";
import { Button } from "../ui/button.tsx";
import { EmptyState } from "./EmptyContent.tsx";
import { epicGraph, criticalPath } from "./epics/epic-graph.ts";
const EpicGraphView = lazy(() =>
  import("./epics/EpicGraphView.tsx").then((module) => ({ default: module.EpicGraphView })),
);
export function epicsSearch(search: Record<string, unknown>): { root?: string; selected?: string } {
  return {
    ...(typeof search["root"] === "string" && search["root"] ? { root: search["root"] } : {}),
    ...(typeof search["selected"] === "string" && search["selected"]
      ? { selected: search["selected"] }
      : {}),
  };
}
function useSwitch(name: string) {
  const key = `manifold.epics.${name}`;
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) !== "false";
    } catch {
      return true;
    }
  });
  return [
    value,
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        /* The screen still works without browser storage. */
      }
    },
  ] as const;
}
export function EpicsContent() {
  const search = useSearch({ strict: false }),
    params = epicsSearch(search),
    navigate = useNavigate();
  const [showCritical, setCritical] = useSwitch("criticalPath"),
    [fadeCompleted, setFade] = useSwitch("fadeCompleted");
  const roots = useQuery({
    queryKey: ["epics"],
    queryFn: fetchEpicRoots,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    retry: false,
  });
  const root =
    params.root ?? (roots.data?.kind === "ok" ? roots.data.roots[0]?.issue.nodeId : undefined);
  const query = useQuery({
    queryKey: ["epic", root],
    queryFn: root ? () => fetchEpic(root) : skipToken,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    retry: false,
  });
  const epic = query.data?.kind === "ok" ? query.data.epic : undefined;
  const graph = useMemo(() => (epic ? epicGraph(epic) : undefined), [epic]);
  const selected =
    params.selected && graph?.nodes.includes(params.selected) ? params.selected : undefined;
  const select = (id?: string) => {
    void navigate({
      to: "/epics",
      search: { ...(root ? { root } : {}), ...(id ? { selected: id } : {}) },
    });
  };
  const refresh = () => {
    void roots.refetch();
    if (root) void query.refetch();
  };
  const failure =
    roots.data?.kind === "failed"
      ? roots.data
      : query.data?.kind === "failed"
        ? query.data
        : undefined;
  if (failure)
    return (
      <div role="alert" className="error-alert">
        <p>{failure.message}</p>
        <Button onClick={refresh}>Try again</Button>
      </div>
    );
  if (!roots.data) return <p role="status">Loading epics…</p>;
  if (!root)
    return (
      <EmptyState
        icon={GitBranch}
        title="No epics"
        description="An epic appears here when a tracked issue has sub-issues on GitHub."
      />
    );
  const options = roots.data.kind === "ok" ? [...roots.data.roots] : [];
  if (epic && !options.some((r) => r.issue.nodeId === root))
    options.unshift({ issue: epic.issues[0]!.issue });
  const tree = epic?.issues.filter((i) => i.placement === "tree") ?? [],
    done = tree.filter((i) => i.issue.state === "closed").length;
  const picked = epic?.issues.find((i) => i.issue.nodeId === selected),
    chain = graph && selected ? criticalPath(graph, selected) : undefined;
  const reference = (id: string) => {
    const i = epic!.issues.find((i) => i.issue.nodeId === id)!.issue;
    return `${i.repository}#${i.number}`;
  };
  const cyclic = graph?.edges.filter((e) => e.cyclic).length ?? 0;
  return (
    <div
      className="epics-screen"
      onKeyDown={(event) => {
        if (event.key === "Escape") select();
      }}
    >
      <div className="epics-toolbar">
        <label>
          Root task
          <select
            className="mono"
            aria-label="Root task"
            value={root}
            onChange={(e) => {
              void navigate({ to: "/epics", search: { root: e.target.value } });
            }}
          >
            {!options.some((r) => r.issue.nodeId === root) ? (
              <option value={root}>{root}</option>
            ) : null}
            {options.map(({ issue }) => (
              <option key={issue.nodeId} value={issue.nodeId}>
                {issue.repository}#{issue.number} {issue.title}{" "}
                {issue.state === "closed" ? "Closed" : ""}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          {tree.length} tasks · {done} done · {tree.length - done} open
        </span>
        <Button variant="ghost" size="icon" aria-label="Refresh epics" onClick={refresh}>
          <RefreshCw size={16} />
        </Button>
        <span className="toolbar-space" />
        <label>
          <input
            type="checkbox"
            role="switch"
            checked={showCritical}
            onChange={(e) => setCritical(e.target.checked)}
          />
          Critical path
        </label>
        <label>
          <input
            type="checkbox"
            role="switch"
            checked={fadeCompleted}
            onChange={(e) => setFade(e.target.checked)}
          />
          Fade completed
        </label>
      </div>
      {cyclic ? (
        <div role="alert" className="epics-warning">
          {cyclic} dependencies on GitHub form a cycle. The critical path leaves them out.
        </div>
      ) : null}
      <div className="epic-card">
        {query.data?.kind === "missing" ? (
          <EmptyState
            icon={GitBranch}
            title="Root task not found"
            description="This issue is not on a bound Project."
          >
            <Link to="/epics" search={{}}>
              Epics
            </Link>
          </EmptyState>
        ) : !epic ? (
          <p role="status">Loading epic…</p>
        ) : !tree.length ? (
          <EmptyState
            icon={GitBranch}
            title="No sub-issues"
            description="This issue has no sub-issues on GitHub."
          />
        ) : (
          <Suspense fallback={<p role="status">Loading graph…</p>}>
            <EpicGraphView
              key={epic.root}
              epic={epic}
              graph={graph!}
              state={{
                criticalPath: showCritical,
                fadeCompleted,
                ...(selected ? { selected } : {}),
              }}
              onSelect={select}
            />
          </Suspense>
        )}
      </div>
      <div className="epic-selection">
        {picked && chain ? (
          <>
            <div className="epic-chain">
              <span>
                {chain.nodes.map((id, i) => (
                  <span key={id}>
                    {i ? " → " : ""}
                    <span className={`mono ${id === selected ? "primary-text" : ""}`}>
                      {reference(id)}
                    </span>
                  </span>
                ))}
              </span>
            </div>
            <span>{chain.open} open</span>
            <Button variant="ghost" onClick={() => select()}>
              Clear
            </Button>
            {picked.task ? (
              <Link
                className="task-link primary"
                to="/epics/task/$actorId"
                params={{ actorId: picked.task.actorId }}
                search={{ root, selected }}
              >
                Open task
              </Link>
            ) : picked.issue.url ? (
              <a
                className="task-link outline"
                href={picked.issue.url}
                target="_blank"
                rel="noreferrer"
              >
                Open on GitHub
              </a>
            ) : null}
          </>
        ) : (
          <span className="muted">Select a task to see the chain through it.</span>
        )}
      </div>
    </div>
  );
}
