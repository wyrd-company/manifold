// ---
// relationships:
//   implements: task-metadata
// ---
import { createHash } from "node:crypto";
import { lintTaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
import type {
  ProcessRepositoryRevision,
  TaskMetadataDeclaration,
} from "@wyrd-company/manifold-shared";
import type { TaskMetadataOptions } from "./types.ts";
import type { metadataRecords } from "./records.ts";
import type {
  AppliedChange,
  ApplyAnswer,
  ApplyRequest,
  BoundProject,
  ConfigurationSource,
  ProjectConfiguration,
} from "./project-types.ts";
import {
  appliedConfiguration,
  canonical,
  planProjectConfiguration,
  projectWrites,
} from "./plan.ts";
import { acceptFields } from "./accept.ts";
export class ProjectRequestError extends Error {
  readonly status: number;
  readonly kind: string;
  readonly detail: Record<string, unknown>;
  constructor(status: number, kind: string, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.kind = kind;
    this.detail = detail;
  }
}
export function createProjects(
  options: TaskMetadataOptions,
  records: ReturnType<typeof metadataRecords>,
  current: () => TaskMetadataDeclaration | undefined,
  revision: () => ProcessRepositoryRevision | undefined,
) {
  const controller = new AbortController();
  const queues = new Map<string, Promise<unknown>>();
  const now = options.now ?? Date.now;
  let cachedSource: ConfigurationSource | undefined;
  let closed = false;
  async function source(signal = controller.signal) {
    const value = await options.source(signal);
    if (
      !value.projectByNumber ||
      !value.projectFields ||
      !value.observeProjectFields ||
      !value.writeProjectField
    )
      throw new ProjectRequestError(
        503,
        "unavailable",
        "Project configuration source is unavailable",
      );
    cachedSource = value as ConfigurationSource;
    return cachedSource;
  }
  void source().catch(() => {});
  const bindings = () => options.bindings?.() ?? [];
  function bound(name: string) {
    if (closed)
      throw new ProjectRequestError(503, "unavailable", "Project configuration is closed");
    const binding = bindings().find((b) => b.binding === name);
    if (!binding)
      throw new ProjectRequestError(404, "unknown-binding", `Unknown Project binding: ${name}`);
    return binding;
  }
  function resolved(s: ConfigurationSource, b: BoundProject) {
    const project = s.projectByNumber(b.owner, b.number);
    if (!project)
      throw new ProjectRequestError(
        409,
        "unresolved-project",
        `Project is unresolved: ${b.binding}`,
      );
    return project;
  }
  async function plan(binding: string, signal?: AbortSignal) {
    const b = bound(binding);
    const s = await source(signal);
    const project = resolved(s, b);
    let observation: { status: "fresh" } | { status: "stale"; message: string } = {
      status: "fresh",
    };
    let fields;
    try {
      fields = await s.observeProjectFields(project.nodeId, signal);
    } catch (error) {
      fields = s.projectFields(project.nodeId);
      if (!fields)
        throw new ProjectRequestError(502, "unobserved", "Project fields have never been observed");
      observation = {
        status: "stale",
        message: error instanceof Error ? error.message : "Project observation failed",
      };
    }
    return {
      ...planProjectConfiguration({
        metadata: current()?.projects[binding],
        fields: fields.fields,
        applied: records.applied(binding, project.nodeId),
      }),
      binding,
      owner: b.owner,
      number: b.number,
      projectNodeId: project.nodeId,
      declarationCommit: revision()?.commit ?? records.commit() ?? null,
      observedAt: fields.readAt,
      observation,
      frontMatter: null,
    };
  }
  async function apply(binding: string, request: ApplyRequest): Promise<ApplyAnswer> {
    const b = bound(binding);
    const declaration = current();
    const metadata = declaration?.projects[binding];
    const commit = revision()?.commit ?? records.commit();
    if (!metadata || !commit)
      throw new ProjectRequestError(
        409,
        "undeclared",
        `Project metadata is not declared: ${binding}`,
      );
    const s = await source();
    const project = resolved(s, b);
    const previous = records.applied(binding, project.nodeId);
    const observed = await s.observeProjectFields(project.nodeId, controller.signal);
    const input = { metadata, fields: observed.fields, applied: previous };
    const planned = planProjectConfiguration(input);
    if (request.digest !== undefined && request.digest !== planned.digest)
      throw new ProjectRequestError(409, "plan-stale", "Project configuration plan has changed");
    const outcomes: AppliedChange[] = planned.changes.map((c) => ({
      ...c,
      outcome: c.requiresRemoval && !request.removeUndeclared ? "kept" : "not-run",
    }));
    const acceptance = planned.changes.filter((c) => c.side === "declaration");
    let acceptedText: string | undefined;
    let saveId: string | undefined;
    if (acceptance.length) {
      const captured = revision();
      const baseRevision =
        captured?.commit === commit ? captured : await options.revisionAt?.(commit);
      if (!baseRevision || baseRevision.commit !== commit)
        throw new ProjectRequestError(503, "unavailable", "Declaration revision is unavailable");
      const [text, bindingsText] = await Promise.all([
        baseRevision.read("task-metadata.yml"),
        baseRevision.read("bindings.yml"),
      ]);
      acceptedText = acceptFields(text ?? "", binding, acceptance, input);
      const lint = lintTaskMetadataDeclaration({
        taskMetadata: acceptedText,
        bindings: bindingsText,
      });
      if (!lint.ok)
        throw new ProjectRequestError(
          409,
          "declaration-invalid",
          lint.findings.map((f) => f.message).join("; "),
        );
      saveId = createHash("sha256")
        .update(canonical({ binding, base: commit, text: acceptedText }))
        .digest("hex")
        .slice(0, 32);
    }
    let writes = 0;
    let savedCommit: string | null = null;
    for (const group of projectWrites(input, planned, project.nodeId, request.removeUndeclared)) {
      try {
        await s.writeProjectField(group.write, controller.signal);
        writes++;
      } catch (error) {
        for (const c of group.changes)
          outcomes[outcomes.findIndex((o) => o.id === c.id)] = { ...c, outcome: "failed" };
        const kind = error instanceof Error && "kind" in error ? String(error.kind) : "transport";
        throw new ProjectRequestError(
          502,
          kind,
          error instanceof Error ? error.message : "GitHub write failed",
          { writes, changes: outcomes },
        );
      }
      for (const c of group.changes)
        outcomes[outcomes.findIndex((o) => o.id === c.id)] = { ...c, outcome: "applied" };
    }
    if (acceptedText !== undefined) {
      if (!options.revisions)
        throw new ProjectRequestError(503, "unavailable", "Declaration save is unavailable");
      let saved;
      try {
        saved = await options.revisions.save({
          path: "task-metadata.yml",
          base: commit,
          text: acceptedText,
          message: `Accept GitHub changes to the task fields of ${binding}`,
          saveId: saveId!,
        });
      } catch (error) {
        const pending = records.pending(binding, saveId!);
        if (pending)
          throw new ProjectRequestError(
            409,
            "declaration-pending",
            "Accepted declaration is not in force",
            { commit: pending, writes, changes: outcomes },
          );
        throw new ProjectRequestError(
          502,
          "declaration-unsaved",
          error instanceof Error ? error.message : "Declaration save failed",
          { writes, changes: outcomes },
        );
      }
      if (saved.outcome === "conflict")
        throw new ProjectRequestError(
          409,
          "declaration-conflict",
          "Task metadata declaration changed",
          { writes, changes: outcomes },
        );
      if (saved.outcome === "saved" && saved.blueprints === undefined) {
        records.savePending(binding, saveId!, saved.commit, now());
        throw new ProjectRequestError(
          409,
          "declaration-pending",
          "Accepted declaration is not in force",
          { commit: saved.commit, writes, changes: outcomes },
        );
      }
      savedCommit = saved.commit;
      const after = await s.observeProjectFields(project.nodeId, controller.signal);
      const stillPending = planProjectConfiguration({
        metadata: current()?.projects[binding],
        fields: after.fields,
        applied: previous,
      }).changes.some((c) => c.side === "declaration");
      if (stillPending) {
        records.savePending(binding, saveId!, saved.commit, now());
        throw new ProjectRequestError(
          409,
          "declaration-pending",
          "Accepted declaration is not in force",
          { commit: saved.commit, writes, changes: outcomes },
        );
      }
      for (const c of acceptance)
        outcomes[outcomes.findIndex((o) => o.id === c.id)] = { ...c, outcome: "applied" };
    }
    const after = await s.observeProjectFields(project.nodeId, controller.signal);
    const latest = current()?.projects[binding];
    if (!latest)
      throw new ProjectRequestError(
        409,
        "undeclared",
        "Project declaration was removed during Apply",
      );
    const applied = appliedConfiguration(latest, after.fields, previous);
    records.recordApply(
      binding,
      project.nodeId,
      revision()?.commit ?? records.commit()!,
      applied,
      now(),
    );
    return {
      outcome: planned.changes.length ? "applied" : "in-sync",
      changes: outcomes,
      writes,
      configuration: planProjectConfiguration({ metadata: latest, fields: after.fields, applied })
        .configuration,
      declarationCommit: savedCommit,
    };
  }
  const projects: ProjectConfiguration = {
    list: () => {
      if (closed)
        throw new ProjectRequestError(503, "unavailable", "Project configuration is closed");
      return bindings().map((b) => {
        const project = cachedSource?.projectByNumber(b.owner, b.number);
        const fields = project ? cachedSource?.projectFields(project.nodeId) : undefined;
        const applied = project ? records.applied(b.binding, project.nodeId) : undefined;
        return {
          ...b,
          projectNodeId: project?.nodeId ?? null,
          configuration: fields
            ? planProjectConfiguration({
                metadata: current()?.projects[b.binding],
                fields: fields.fields,
                applied,
              }).configuration
            : { state: "not-applied" as const },
          lastApplied: applied ? { at: applied.at, commit: applied.commit } : null,
          observedAt: fields?.readAt ?? null,
        };
      });
    },
    plan,
    apply(binding, request) {
      if (closed)
        return Promise.reject(
          new ProjectRequestError(503, "unavailable", "Project configuration is closed"),
        );
      const operation = (queues.get(binding) ?? Promise.resolve())
        .catch(() => {})
        .then(async () => {
          try {
            return await apply(binding, request);
          } catch (error) {
            if (error instanceof ProjectRequestError && error.status !== 502) throw error;
            throw new ProjectRequestError(
              502,
              error instanceof Error && "kind" in error ? String(error.kind) : "transport",
              error instanceof Error ? error.message : "Project Apply failed",
              {
                writes: 0,
                changes: [],
                ...(error instanceof ProjectRequestError ? error.detail : {}),
              },
            );
          }
        });
      queues.set(binding, operation);
      void operation
        .finally(() => {
          if (queues.get(binding) === operation) queues.delete(binding);
        })
        .catch(() => {});
      return operation;
    },
    planDeclaration: (declaration) =>
      bindings().flatMap((b) => {
        const project = cachedSource?.projectByNumber(b.owner, b.number);
        const fields = project ? cachedSource?.projectFields(project.nodeId) : undefined;
        if (!project || !fields) return [];
        const planned = planProjectConfiguration({
          metadata: declaration.projects[b.binding],
          fields: fields.fields,
          applied: records.applied(b.binding, project.nodeId),
        });
        return [
          {
            binding: b.binding,
            owner: b.owner,
            number: b.number,
            configuration: planned.configuration,
            changes: planned.changes,
            fields: planned.fields,
          },
        ];
      }),
  };
  return {
    projects,
    async close() {
      closed = true;
      controller.abort();
      await Promise.allSettled(queues.values());
    },
  };
}
