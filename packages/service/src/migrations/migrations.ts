// ---
// relationships:
//   implements: blueprint-migration
// ---
import { laterVersion } from "./later.ts";
import { blueprintVersionKey, parseBlueprintVersionKey } from "@wyrd-company/manifold-shared";
import type { BlueprintVersion } from "@wyrd-company/manifold-shared";
import type { ActorHost, MigrationFailure } from "../actor-host/index.ts";
import type { BundleSource, RevisionLoad } from "../blueprint-loader/index.ts";
import type { Escalation, Escalations } from "../escalations/index.ts";
import type { ServiceLogEntry } from "../service/index.ts";
import type { Store, StoredMigrationFailure } from "../store/index.ts";
export interface MigrationsOptions {
  readonly store: Store;
  readonly actorHost: Pick<ActorHost, "migrate" | "onSaved">;
  latest(): RevisionLoad | undefined;
  isAncestor(ancestor: string, commit: string): Promise<boolean>;
  readonly bundles: Pick<BundleSource, "recordedAt">;
  readonly escalations: Pick<Escalations, "raise" | "withdraw">;
  readonly log: (entry: ServiceLogEntry) => void;
}
export interface MigrationPass {
  readonly migrated: readonly string[];
  readonly deferred: readonly string[];
  readonly failed: readonly StoredMigrationFailure[];
}
export interface Migrations {
  pass(): Promise<MigrationPass>;
  migrationFailed(escalation: Escalation): (() => void) | undefined;
  stop(): Promise<void>;
}
export function openMigrations(options: MigrationsOptions): Migrations {
  const { store, actorHost, latest, escalations, log } = options;
  let tail: Promise<unknown> = Promise.resolve(),
    stopped = false;
  const deferred = new Set<string>(),
    pairs = new Map<string, Promise<boolean>>();
  const immediates = new Set<ReturnType<typeof setImmediate>>();
  function enqueue<T>(job: () => Promise<T>): Promise<T> {
    const promise = tail.catch(() => {}).then(job);
    tail = promise;
    return promise;
  }
  function later(from: BlueprintVersion, to: BlueprintVersion) {
    const key = `${blueprintVersionKey(from)}>${blueprintVersionKey(to)}`;
    let answer = pairs.get(key);
    if (!answer) {
      answer = (async () =>
        laterVersion(from, to, {
          ancestor:
            from.path === to.path && from.commit !== to.commit
              ? await options.isAncestor(from.commit, to.commit)
              : false,
          ...(from.bundle && options.bundles.recordedAt?.(from.bundle) !== undefined
            ? { fromBundle: options.bundles.recordedAt!(from.bundle)! }
            : {}),
          ...(to.bundle && options.bundles.recordedAt?.(to.bundle) !== undefined
            ? { toBundle: options.bundles.recordedAt!(to.bundle)! }
            : {}),
        }))();
      pairs.set(key, answer);
    }
    return answer;
  }
  function failure(actorId: string, value: MigrationFailure): StoredMigrationFailure | undefined {
    try {
      const recorded = store.connection.transaction(() => {
        const recorded = store.recordMigrationFailure({ actorId, ...value });
        if (recorded === "recorded" && value.kind !== "version-invalid")
          escalations.raise({
            kind: "migration-failed",
            subject: { version: value.to },
            title: "Migration failed",
            question:
              `Actor: ${actorId}\nVersion: ${value.to}\nCause: ${value.kind}\n${value.message}`.slice(
                0,
                8000,
              ),
            choices: [
              { id: "retry", label: "Retry" },
              { id: "dismiss", label: "Dismiss" },
            ],
          });
        return recorded;
      });
      if (recorded === "recorded")
        log({
          level: "warn",
          event: "migration-failed",
          message: value.message,
          detail: { actorId, ...value },
        });
      return store.migrationFailure(actorId);
    } catch (error) {
      log({
        level: "error",
        event: "migration-failed",
        message: String(error),
        detail: { actorId, from: value.from, to: value.to },
      });
      return undefined;
    }
  }
  async function attempt(
    actorId: string,
    result: { migrated: string[]; deferred: string[]; failed: StoredMigrationFailure[] },
  ) {
    const stored = store.loadSnapshot(actorId),
      revision = latest();
    if (!stored || stored.snapshot.status !== "active" || !revision) return;
    const from = parseBlueprintVersionKey(stored.machine);
    if (!from) return;
    const target = revision.blueprints.get(from.path),
      to = target?.version ?? revision.versions.get(from.path);
    if (!to || stored.machine === blueprintVersionKey(to) || !(await later(from, to))) return;
    const previous = store.migrationFailure(actorId);
    if (previous?.from === stored.machine && previous.to === blueprintVersionKey(to)) return;
    const outcome = target
      ? await actorHost.migrate(actorId, target)
      : {
          status: "failed" as const,
          failure: {
            kind: "version-invalid" as const,
            from: stored.machine,
            to: blueprintVersionKey(to),
            message: "Target blueprint failed to load or lint",
            detail: {
              findings: JSON.parse(JSON.stringify(revision.failures.get(from.path) ?? [])),
            },
          },
        };
    if (outcome.status === "migrated") {
      result.migrated.push(actorId);
      log({
        level: "info",
        event: "actor-migrated",
        message: "Actor migrated",
        detail: {
          actorId,
          from: outcome.from,
          to: outcome.to,
          ...(outcome.path === undefined ? {} : { path: outcome.path }),
        },
      });
      if (previous && !store.migrationFailures(previous.to).length)
        escalations.withdraw({ kind: "migration-failed", subject: { version: previous.to } });
    } else if (outcome.status === "deferred") {
      result.deferred.push(actorId);
      const key = `${actorId}:${blueprintVersionKey(to)}`;
      if (!deferred.has(key)) {
        deferred.add(key);
        log({
          level: "info",
          event: "migration-deferred",
          message: outcome.reason,
          detail: { actorId, to: blueprintVersionKey(to) },
        });
      }
    } else if (outcome.status === "failed") {
      const recorded = failure(actorId, outcome.failure);
      if (recorded) result.failed.push(recorded);
    }
  }
  const empty = () => ({
    migrated: [] as string[],
    deferred: [] as string[],
    failed: [] as StoredMigrationFailure[],
  });
  function scheduled(actorId: string) {
    if (stopped) return;
    const immediate = setImmediate(() => {
      immediates.delete(immediate);
      if (stopped) return;
      void enqueue(() => attempt(actorId, empty())).catch((error) =>
        log({
          level: "error",
          event: "migration-failed",
          message: String(error),
          detail: { actorId },
        }),
      );
    });
    immediates.add(immediate);
  }
  const unsubscribe = actorHost.onSaved((actorId) => {
    try {
      const actor = store.loadSnapshot(actorId),
        revision = latest();
      if (!actor || !revision) return;
      const from = parseBlueprintVersionKey(actor.machine);
      if (!from) return;
      const target =
        revision.blueprints.get(from.path)?.key ??
        (revision.versions.get(from.path)
          ? blueprintVersionKey(revision.versions.get(from.path)!)
          : undefined);
      const failure = store.migrationFailure(actorId);
      if (
        target &&
        target !== actor.machine &&
        !(failure?.from === actor.machine && failure.to === target)
      )
        scheduled(actorId);
    } catch (error) {
      log({
        level: "error",
        event: "migration-failed",
        message: String(error),
        detail: { actorId },
      });
    }
  });
  return {
    pass() {
      if (stopped) throw new TypeError("Migrations are stopped");
      return enqueue(async () => {
        const result = empty();
        for (const actor of store
          .activeSnapshots()
          .sort((a, b) => a.actorId.localeCompare(b.actorId)))
          await attempt(actor.actorId, result);
        return result;
      });
    },
    migrationFailed(escalation) {
      if (
        escalation.raiser.type !== "service" ||
        escalation.raiser.kind !== "migration-failed" ||
        !escalation.answer ||
        !("choice" in escalation.answer.value) ||
        escalation.answer.value.choice !== "retry"
      )
        return undefined;
      const version = escalation.raiser.subject["version"]!;
      const actors = store.migrationFailures(version).map((failure) => failure.actorId);
      store.clearMigrationFailures(version);
      return () => {
        for (const actor of actors) scheduled(actor);
      };
    },
    async stop() {
      stopped = true;
      unsubscribe();
      for (const immediate of immediates) clearImmediate(immediate);
      immediates.clear();
      await tail;
    },
  };
}
