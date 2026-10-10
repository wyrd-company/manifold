// ---
// relationships:
//   implements: operator-console
// ---
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { RefreshCw, Workflow } from "lucide-react";
import { fetchBlueprints } from "../../api/blueprints.ts";
import { Button } from "../../ui/button.tsx";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../ui/table.tsx";
import { EmptyState } from "../EmptyContent.tsx";
import { readDraft } from "./draft.ts";
export function BlueprintsList() {
  const query = useQuery({
    queryKey: ["blueprints"],
    queryFn: fetchBlueprints,
    retry: false,
    staleTime: 0,
  });
  const result = query.data;
  return (
    <>
      <div className="actors-toolbar">
        <span>{result?.kind === "ok" ? `${result.body.blueprints.length} blueprints` : ""}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh blueprints"
          onClick={() => {
            void query.refetch();
          }}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {!result ? (
        <p role="status">Loading blueprints…</p>
      ) : result.kind !== "ok" ? (
        <div role="alert" className="error-alert">
          {"message" in result ? result.message : "Cannot read blueprints."}
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {!result.body.commit ? (
            <p className="blueprint-info" role="status">
              The process repository has not been read yet.
            </p>
          ) : null}
          {result.body.blueprints.length === 0 ? (
            <EmptyState
              icon={Workflow}
              title="No blueprints"
              description="Blueprints appear here when the process repository holds files under blueprints/."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {["Name", "Version", "Lint", "Active actors", ""].map((label) => (
                    <TableHead key={label}>{label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.body.blueprints.map((item) => (
                  <TableRow key={item.path}>
                    <TableCell>
                      <Link to="/blueprints/$" params={{ _splat: item.path }} className="mono">
                        {item.path}
                      </Link>
                      {item.description ? <small>{item.description}</small> : null}
                      {item.replacesBundled ? <small>Replaces the bundled blueprint</small> : null}
                      {readDraft(localStorage, item.path) ? (
                        <small className="warning-text">Draft</small>
                      ) : null}
                    </TableCell>
                    <TableCell className="mono">
                      {item.source === "bundled" ? (
                        <>
                          <span>Bundled</span>
                          <small>{item.bundle?.slice(0, 7)}</small>
                        </>
                      ) : (
                        item.commit?.slice(0, 7)
                      )}
                    </TableCell>
                    <TableCell
                      className={
                        item.findings
                          ? "error-text"
                          : item.warnings
                            ? "warning-text"
                            : "success-text"
                      }
                    >
                      {item.findings
                        ? `${item.findings} errors`
                        : item.warnings
                          ? `${item.warnings} warnings`
                          : "Loaded"}
                    </TableCell>
                    <TableCell>{item.activeActors || <span className="muted">—</span>}</TableCell>
                    <TableCell>
                      <Link to="/blueprints/$" params={{ _splat: item.path }}>
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </>
  );
}
