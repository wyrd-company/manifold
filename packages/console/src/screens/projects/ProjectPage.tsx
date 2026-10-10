// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { fetchProjects, fetchProjectPlan, applyProject } from "../../api/projects.ts";
import type { ProjectSummary, ProjectChange } from "../../api/projects.ts";
import { fetchBindings, fetchDeclarationSource } from "../../api/declarations.ts";
import { Button } from "../../ui/button.tsx";
import { ConfigurationBadge } from "./ConfigurationBadge.tsx";
import { PlanCard } from "./PlanCard.tsx";
import { RemoveDialog } from "./RemoveDialog.tsx";
import { AssociateDialog } from "./AssociateDialog.tsx";
import { planGroups } from "./plan.ts";
export function ProjectPage({ binding }: { binding: string }) {
  const client = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, retry: false });
  const plans = useQuery({
    queryKey: ["project-plan", binding],
    queryFn: () => fetchProjectPlan(binding),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const bindings = useQuery({ queryKey: ["bindings"], queryFn: fetchBindings, retry: false });
  const source = useQuery({
    queryKey: ["declaration", "task-metadata.yml"],
    queryFn: () => fetchDeclarationSource("task-metadata.yml"),
    retry: false,
  });
  const [remove, setRemove] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    remove: boolean;
    digest: string;
    changes: readonly ProjectChange[];
  }>();
  const [associate, setAssociate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    text: string;
    kind: "error" | "info" | "success";
    retry: boolean;
    taskFields?: boolean;
  }>();
  const [configuration, setConfiguration] = useState<ProjectSummary["configuration"]>();
  const [attempt, setAttempt] = useState<{ remove: boolean; digest: string }>();
  const project =
    projects.data?.kind === "ok"
      ? projects.data.body.projects.find((p) => p.binding === binding)
      : undefined;
  const b = bindings.data?.kind === "ok" ? bindings.data.body : undefined;
  const bound = b?.githubProjects.find((p) => p.name === binding);
  const result = plans.data;
  const plan = result?.kind === "ok" ? result.body : undefined;
  const grouped = plan ? planGroups(plan.changes, remove) : undefined;
  const refresh = async () => {
    const [, next] = await Promise.all([
      projects.refetch(),
      plans.refetch(),
      client.invalidateQueries({ queryKey: ["tasks"] }),
    ]);
    return next.data;
  };
  async function send(retry = false, reviewed?: { remove: boolean; digest: string }) {
    const request =
      reviewed ?? (retry && attempt ? attempt : plan ? { remove, digest: plan.digest } : undefined);
    if (!request) return;
    setAttempt(request);
    setConfirmation(undefined);
    setBusy(true);
    setNotice(undefined);
    const answer = await applyProject(binding, request.remove, request.digest);
    if (answer.kind === "ok") {
      setConfiguration(answer.body.configuration);
      setNotice({
        kind: "success",
        text:
          answer.body.outcome === "in-sync"
            ? "Already in sync"
            : `Applied ${answer.body.changes.filter((c) => c.outcome === "applied").length} changes`,
        retry: false,
      });
    } else if (answer.kind === "stale") {
      setConfiguration(undefined);
      const fresh = await refresh();
      const finished =
        fresh?.kind === "ok" &&
        fresh.body.changes.filter((c) => !c.requiresRemoval || remove).length === 0 &&
        fresh.body.configuration.state === "in-sync";
      setNotice({
        kind: "info",
        text: finished
          ? "Another Apply finished these changes first."
          : "The plan changed since you reviewed it. Review the changes, then apply again.",
        retry: false,
      });
    } else if (answer.kind === "invalid")
      setNotice({
        kind: "error",
        text: `${answer.message} Nothing was written. Fix the task fields, or set the field to Revert.`,
        retry: false,
        taskFields: true,
      });
    else if (answer.kind === "pending") {
      setNotice({
        kind: "info",
        text: `Applied on GitHub. The task fields change is saved${answer.commit ? ` as ${answer.commit.slice(0, 7)}` : ""} and not yet in force.`,
        retry: true,
      });
      setAttempt(undefined);
    } else if (answer.kind === "missing") client.setQueryData(["project-plan", binding], answer);
    else
      setNotice({
        kind: "error",
        text:
          answer.message +
          (answer.kind === "failed" && answer.errorKind === "scope-unavailable"
            ? ` Nothing was written.${answer.scopes?.map((scope) => ` ${scope.scope.name}: ${scope.status}.`).join("") ?? ""}`
            : "") +
          (answer.kind === "failed" && answer.writes !== undefined
            ? ` ${answer.writes} writes made.${answer.changes?.find((c) => c.outcome === "failed") ? ` Failed: ${answer.changes.find((c) => c.outcome === "failed")!.description}` : ""}`
            : "") +
          (answer.kind === "failed" && answer.errorKind === "declaration-unsaved"
            ? " The change into the task fields was not saved."
            : ""),
        retry: !(answer.kind === "failed" && answer.errorKind === "scope-unavailable"),
      });
    if (answer.kind !== "stale" && answer.kind !== "missing") await refresh();
    setBusy(false);
  }
  if (result?.kind === "missing" || (projects.data?.kind === "ok" && !project))
    return (
      <div className="projects-empty">
        <h2>Project not bound</h2>
        <p>No bound Project has the name {binding}.</p>
        <Link to="/projects">All Projects</Link>
      </div>
    );
  return (
    <div className="projects-screen">
      <Link to="/projects">← All Projects</Link>
      <div className="project-page-heading">
        <div>
          <h2 className="mono">
            {project ? `${project.owner}/${project.number}` : binding}{" "}
            {project ? (
              <ConfigurationBadge configuration={configuration ?? project.configuration} />
            ) : null}
          </h2>
          <p className="muted">
            {b?.items.find((i) => i.id === project?.portfolioItem)?.title ?? project?.portfolioItem}{" "}
            ·{" "}
            <span className="mono">
              {project?.environment} · Task fields{" "}
              {source.data?.kind === "ok" ? source.data.body.commit.slice(0, 7) : "—"}
            </span>{" "}
            ·{" "}
            {project?.lastApplied
              ? `Applied ${new Date(project.lastApplied.at).toLocaleString()}`
              : "Never applied"}
          </p>
        </div>
        <div className="projects-actions">
          <Button variant="ghost" render={<Link to="/settings/task-fields" />}>
            Task fields
          </Button>
          <Button
            disabled={
              busy || !grouped?.count || plan?.scopes?.some((scope) => scope.status !== "ready")
            }
            title={
              plan?.scopes?.some((scope) => scope.status !== "ready")
                ? "A scope cannot be applied."
                : undefined
            }
            onClick={() => {
              if (grouped?.removals.length && plan)
                setConfirmation({ remove, digest: plan.digest, changes: grouped.removals });
              else void send();
            }}
          >
            {busy
              ? "Applying…"
              : grouped?.count
                ? `Apply ${grouped.count} changes`
                : "Nothing to apply"}
          </Button>
        </div>
      </div>
      <section className="project-card">
        <div className="project-card-heading">
          <h3>
            T3code projects <span className="muted">{bound?.t3codeProjects.length ?? 0}</span>
          </h3>
          <Button variant="outline" disabled={!bound} onClick={() => setAssociate(true)}>
            Associate existing
          </Button>
        </div>
        {bound?.t3codeProjects.length ? (
          bound.t3codeProjects.map((id) => {
            const env = b?.environments.find((e) => e.name === bound.environment);
            const p = env?.projects?.find((p) => p.id === id);
            return (
              <div className="plan-row" key={id}>
                <span className="mono">
                  {p?.title ?? id}
                  <small className="muted">
                    {p?.workspaceRoot ?? (env?.projects ? `Not found on ${bound.environment}` : "")}
                  </small>
                </span>
                <span className="muted">{p?.activeThreads ?? "—"} active threads</span>
              </div>
            );
          })
        ) : (
          <p className="muted">No T3code projects are associated with this Project.</p>
        )}
      </section>
      {notice ? (
        <div
          role={notice.kind === "error" ? "alert" : "status"}
          className={
            notice.kind === "error"
              ? "error-alert"
              : notice.kind === "success"
                ? "success-text"
                : "blueprint-info"
          }
        >
          {notice.text}
          {notice.taskFields ? <Link to="/settings/task-fields">Task fields</Link> : null}
          {notice.retry ? (
            <Button disabled={busy} onClick={() => void send(true)}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
      {!result ? (
        <p role="status">Loading plan…</p>
      ) : result.kind === "unresolved" ? (
        <p className="blueprint-info">
          Manifold has not found this Project on GitHub yet.{" "}
          <Button onClick={() => void refresh()}>Try again</Button>
        </p>
      ) : plan ? (
        <PlanCard plan={plan} removeUndeclared={remove} onRemove={setRemove} busy={busy} />
      ) : (
        <div role="alert" className="error-alert">
          {"message" in result ? result.message : "Cannot read plan."}
          <Button onClick={() => void refresh()}>Try again</Button>
        </div>
      )}
      <RemoveDialog
        open={!!confirmation}
        changes={confirmation?.changes ?? []}
        onClose={() => setConfirmation(undefined)}
        onApply={() => void send(false, confirmation)}
      />
      {associate && b && bound ? (
        <AssociateDialog bindings={b} binding={bound} onClose={() => setAssociate(false)} />
      ) : null}
    </div>
  );
}
