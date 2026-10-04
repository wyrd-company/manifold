// ---
// relationships:
//   implements:
//     - service-assembly
//     - gate-runtime
// ---
import type { BlueprintLoader, RevisionLoad } from "../blueprint-loader/index.ts";
import type { IntakeRevision } from "../intake/index.ts";
import type { Usage } from "../usage/index.ts";
import type { Gates } from "../gates/index.ts";
import type { Portfolio } from "../portfolio/index.ts";
import type { ProcessRepository } from "../process-repository/index.ts";
import type { AppliedRevision, Revisions, ServiceLogEntry } from "./types.ts";
export function createRevisions(options: {
  readonly repository: ProcessRepository;
  readonly blueprints: BlueprintLoader;
  readonly portfolio: Portfolio;
  readonly usage: Pick<Usage, "apply">;
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
  return {
    latest: () => latest,
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
