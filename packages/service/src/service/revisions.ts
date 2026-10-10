// ---
// relationships:
//   implements:
//     - service-assembly
//     - gate-runtime
// ---
import type { TaskMetadata } from "../task-metadata/index.ts";
import type { BlueprintLoader, RevisionLoad } from "../blueprint-loader/index.ts";
import type { IntakeRevision } from "../intake/index.ts";
import type { Usage } from "../usage/index.ts";
import type { Gates } from "../gates/index.ts";
import type { Portfolio } from "../portfolio/index.ts";
import { ProcessRepositorySaveError } from "../process-repository/index.ts";
import type { SaveRequest, SaveOutcome } from "../process-repository/index.ts";
import type { ProcessRepository } from "../process-repository/index.ts";
import type { AppliedRevision, Revisions, ServiceLogEntry, SavedRevision } from "./types.ts";
export function createRevisions(options: {
  readonly repository: ProcessRepository;
  readonly blueprints: BlueprintLoader;
  readonly portfolio: Portfolio;
  readonly usage: Pick<Usage, "apply">;
  readonly taskMetadata?: Pick<TaskMetadata, "apply">;
  readonly gates?: Gates;
  readonly log: (entry: ServiceLogEntry) => void;
  readonly applied?: (revision: AppliedRevision) => void;
}): Revisions & { close(): Promise<void> } {
  let followed: string | undefined;
  let current: IntakeRevision | undefined;
  let latest: RevisionLoad | undefined;
  let queue: Promise<void> = Promise.resolve();
  let closed = false;
  async function apply() {
    const revision = options.repository.current();
    if (!revision || revision.commit === followed) return;
    const loaded = await options.blueprints.loadRevision(revision);
    latest = loaded;
    for (const [path, findings] of loaded.failures)
      options.log({
        level: "warn",
        event: "blueprint-invalid",
        message: `Invalid blueprint: ${path}`,
        detail: { commit: revision.commit, findings: findings.map((f) => ({ ...f })) },
      });
    for (const [path, blueprint] of loaded.blueprints)
      if (blueprint.warnings.length)
        options.log({
          level: "warn",
          event: "blueprint-warnings",
          message: `Blueprint warnings: ${path}`,
          detail: {
            commit: revision.commit,
            warnings: blueprint.warnings.map((finding) => ({ ...finding })),
          },
        });
    const result = await options.portfolio.apply(revision);
    if (result.status === "rejected")
      options.log({
        level: "warn",
        event: "portfolio-rejected",
        message: "Portfolio declaration rejected",
        detail: {
          commit: revision.commit,
          findings: result.findings.map((f) => ({
            file: f.file,
            location: f.location,
            kind: f.kind,
            message: f.message,
          })),
        },
      });
    if (result.warnings.length)
      options.log({
        level: "warn",
        event: "portfolio-warnings",
        message: "Portfolio declaration warnings",
        detail: {
          commit: revision.commit,
          warnings: result.warnings.map((warning) => ({ ...warning })),
        },
      });
    const metadataResult = await options.taskMetadata?.apply(revision);
    if (metadataResult?.status === "rejected")
      options.log({
        level: "warn",
        event: "task-metadata-rejected",
        message: "Task metadata declaration rejected",
        detail: {
          commit: revision.commit,
          findings: metadataResult.findings.map((f) => ({ ...f })),
        },
      });
    const usageResult = await options.usage.apply(revision);
    if (usageResult.status === "rejected")
      options.log({
        level: "warn",
        event: "usage-rejected",
        message: "Usage declaration rejected",
        detail: { commit: revision.commit, findings: usageResult.findings.map((f) => ({ ...f })) },
      });
    await options.gates?.revision(loaded, revision);
    options.gates?.inputChanged();
    current = { revision, blueprints: loaded, portfolio: options.portfolio.current() };
    followed = revision.commit;
    options.log({
      level: "info",
      event: "revision-applied",
      message: "Revision applied",
      detail: { commit: revision.commit, portfolio: result.status, usage: usageResult.status },
    });
    options.applied?.({
      commit: revision.commit,
      blueprints: loaded,
      portfolio: result.status,
      usage: usageResult.status,
    });
  }
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    if (closed) return Promise.reject(new TypeError("Revision follower is closed"));
    const operation = queue.then(job);
    queue = operation.then(
      () => {},
      () => {},
    );
    return operation;
  }
  async function pullAndApply() {
    await apply();
    try {
      await options.repository.pull();
    } catch (error) {
      await apply();
      throw error;
    }
    await apply();
  }
  async function savedResult(result: SaveOutcome): Promise<SavedRevision> {
    if (result.kind === "conflict")
      return {
        outcome: "conflict",
        reason: "file-changed",
        head: result.head,
        files: result.files,
      };
    if (result.kind !== "pushed")
      return { outcome: result.kind, commit: result.commit, blueprints: latest };
    try {
      await pullAndApply();
    } catch {
      return { outcome: "saved", commit: result.commit, blueprints: undefined };
    }
    return { outcome: "saved", commit: result.commit, blueprints: latest };
  }
  async function save(request: SaveRequest): Promise<SavedRevision> {
    await pullAndApply();
    try {
      return await savedResult(await options.repository.save(request));
    } catch (error) {
      if (!(error instanceof ProcessRepositorySaveError)) throw error;
      await pullAndApply();
      if (options.repository.current()!.commit === error.head) throw error;
      try {
        return await savedResult(await options.repository.save(request));
      } catch (second) {
        if (!(second instanceof ProcessRepositorySaveError)) throw second;
        await pullAndApply();
        const recovered = await options.repository.findSave(request);
        if (recovered) return { outcome: "already-saved", commit: recovered, blueprints: latest };
        const revision = options.repository.current()!;
        if (revision.commit === second.head) throw second;
        return {
          outcome: "conflict",
          reason: "branch-moved",
          head: revision.commit,
          files: await Promise.all(
            request.files.map(async (file) => ({
              path: file.path,
              text: await revision.read(file.path),
            })),
          ),
        };
      }
    }
  }
  return {
    latest: () => latest,
    findSave: (request) =>
      enqueue(async () => {
        await pullAndApply();
        return options.repository.findSave(request);
      }),
    save: (request) => enqueue(() => save(request)),
    current: () => current,
    follow: () => enqueue(apply),
    pull: (request) =>
      enqueue(async () => {
        await apply();
        const result = await options.repository.pull(request).catch(async (error) => {
          await apply();
          throw error;
        });
        await apply();
        return result;
      }),
    close() {
      closed = true;
      return queue;
    },
  };
}
