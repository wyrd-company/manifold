// ---
// relationships:
//   implements: [operator-console, actors-api]
// ---
import { useQuery } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";
import { fetchActors } from "../api/client.ts";
import { Button } from "../ui/button.tsx";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "../ui/table.tsx";
import { EmptyState } from "./EmptyContent.tsx";
export function ActorsContent() {
  const query = useQuery({
    queryKey: ["actors"],
    queryFn: fetchActors,
    staleTime: 0,
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
    retry: false,
  });
  const result = query.data;
  return (
    <>
      <div className="actors-toolbar">
        <span>{result?.kind === "ok" ? `${result.actors.length} active actors` : ""}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh actors"
          disabled={query.isFetching}
          onClick={() => {
            void query.refetch();
          }}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {!result ? (
        <p role="status">Loading actors…</p>
      ) : result.kind === "failed" ? (
        <div role="alert" className="error-alert">
          <p>{result.message}</p>
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : result.actors.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No active actors"
          description="Actors appear here while a blueprint runs."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {["Task", "Portfolio item", "Blueprint", "Current state", "Environment"].map(
                (label) => (
                  <TableHead key={label}>{label}</TableHead>
                ),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.actors.map((actor) => (
              <TableRow key={actor.actorId}>
                <TableCell className="mono">
                  {actor.issue ?? actor.actorId}
                  {actor.issue ? <small>{actor.actorId}</small> : null}
                </TableCell>
                <TableCell>{actor.portfolioItem ?? <span className="muted">—</span>}</TableCell>
                <TableCell className="mono">
                  {actor.blueprint ? (
                    <>
                      {actor.blueprint.path}
                      <small>{actor.blueprint.commit.slice(0, 7)}</small>
                    </>
                  ) : (
                    actor.machine
                  )}
                </TableCell>
                <TableCell className="mono">
                  {actor.states.map((state) => (
                    <div className="state-path" key={state}>
                      <span className="status-dot" aria-hidden="true" />
                      {state}
                    </div>
                  ))}
                </TableCell>
                <TableCell className="mono">
                  {actor.environment ?? <span className="muted">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
