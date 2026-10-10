// ---
// relationships:
//   implements: github-event-source
// ---
import { createHash } from "node:crypto";
import { taskWriteRecords, writeBody } from "./body-write.ts";
import type { StorageScope } from "@wyrd-company/manifold-shared";
import { trackedIssueIndex } from "./mirror.ts";
import type { TaskFieldWrite, ScopeConfiguration, ScopeEntityWrite } from "./types.ts";
import { moveRecords } from "./move-records.ts";
import type { CardMove } from "./types.ts";
import { createGitHubApi, classifyWriteError } from "./github-api.ts";
import { createMirror } from "./mirror.ts";
import type { Pending } from "./mirror.ts";
import { reconcileIssue, reconcileItem, reconcileProject, isTracked } from "./reconcile.ts";
import type { MirrorState } from "./reconcile.ts";
import { validEvent } from "./verify.ts";
import { GitHubSourceError, GitHubWriteError } from "./types.ts";
import type {
  GitHubSourceOptions,
  GitHubProject,
  ObservedIssue,
  ObservedItem,
  ProjectField,
  ProjectFields,
  ProjectFieldWrite,
} from "./types.ts";
import type { RouterClock, SourceEvent } from "../router/index.ts";

export const systemClock: RouterClock = {
  now: Date.now,
  setTimer(delay, wake) {
    const timer = setTimeout(wake, delay);
    timer.unref();
    return () => clearTimeout(timer);
  },
};
export function createRunner(
  options: GitHubSourceOptions,
  mirror: ReturnType<typeof createMirror>,
  clock: RouterClock,
) {
  const api = createGitHubApi(options, clock);
  const moves = moveRecords(options.store.connection);
  const taskWrites = taskWriteRecords(options.store.connection);
  type Job =
    | {
        kind: "operation";
        run: () => Promise<void>;
        signal: AbortSignal | undefined;
        reject: (error: unknown) => void;
        detach: () => void;
      }
    | {
        kind: "move";
        move: CardMove;
        signal: AbortSignal | undefined;
        resolve: () => void;
        reject: (error: unknown) => void;
        detach: () => void;
      }
    | {
        kind: "observe";
        projectNodeId: string;
        signal: AbortSignal | undefined;
        resolve: (fields: ProjectFields) => void;
        reject: (error: unknown) => void;
        detach: () => void;
      }
    | {
        kind: "write";
        write: ProjectFieldWrite;
        signal: AbortSignal | undefined;
        resolve: (field: ProjectField | undefined) => void;
        reject: (error: unknown) => void;
        detach: () => void;
      };
  const queue: Job[] = [];
  const bound = new Map<string, GitHubProject>();
  let stopped = false;
  let scanDue = true;
  let sweepDue = true;
  let wakeRequested = false;
  let running: Promise<void> | undefined;
  let cancelScan: (() => void) | undefined;
  let cancelSweep: (() => void) | undefined;
  const report = (error: unknown) => {
    if (!stopped)
      options.onError?.(
        error instanceof GitHubSourceError
          ? error
          : new GitHubSourceError("api", "GitHub reconcile failed", undefined, error),
      );
  };
  const pull = (commit?: string) => {
    try {
      void options.processRepository
        .pull(commit ? { commit } : undefined)
        .catch((error) =>
          report(new GitHubSourceError("pull", "Process repository pull failed", undefined, error)),
        );
    } catch (error) {
      report(new GitHubSourceError("pull", "Process repository pull failed", undefined, error));
    }
  };
  // Resolve saved references synchronously, before the first wake or receive.
  for (const reference of options.boundProjects())
    for (const row of mirror.read().projects.values())
      if (
        reference.owner.toLowerCase() === row.project.owner.toLowerCase() &&
        reference.number === row.project.number
      )
        bound.set(row.project.nodeId, row.project);
  async function drainJobs() {
    while (queue.length) {
      if (stopped) return;
      await jobNext();
    }
  }
  async function observeFields(
    project: GitHubProject,
    signal?: AbortSignal,
  ): Promise<ProjectFields> {
    const fields = await api.projectFields(project, signal);
    if (!stopped) {
      let changed = false;
      options.store.connection.transaction(() => {
        changed = mirror.observeFields(project.nodeId, fields, clock.now());
      });
      if (changed) options.onMirrorChanged?.();
    }
    return mirror.projectFields(project.nodeId)!;
  }
  async function rebuild() {
    const next = new Map<string, GitHubProject>();
    for (const reference of options.boundProjects()) {
      await drainJobs();
      if (stopped) return;
      try {
        const owner = Object.keys(options.configuration.owners).find(
          (login) => login.toLowerCase() === reference.owner.toLowerCase(),
        );
        if (!owner)
          throw new GitHubSourceError(
            "unconfigured-owner",
            `GitHub owner is not configured: ${reference.owner}`,
          );
        let project = [...mirror.read().projects.values()].find(
          (row) =>
            row.project.owner.toLowerCase() === owner.toLowerCase() &&
            row.project.number === reference.number,
        )?.project;
        if (!project) {
          const resolved = await api.resolveProject(owner, reference.number);
          project = resolved.project;
          const changed = options.store.connection.transaction(() => {
            const before = mirror.read();
            const after = structuredClone(before);
            after.projects.set(project!.nodeId, { ...resolved, revision: 0 });
            return mirror.write(before, after);
          });
          if (changed) options.onMirrorChanged?.();
        }
        next.set(project.nodeId, project);
        await drainJobs();
      } catch (error) {
        report(error);
      }
    }
    if (!stopped) {
      bound.clear();
      for (const [id, project] of next) bound.set(id, project);
    }
  }
  function credentialOwner(state: MirrorState, id: string) {
    const repoOwner = state.issues.get(id)?.issue.repository.split("/")[0];
    const configured = Object.keys(options.configuration.owners).find(
      (owner) => owner.toLowerCase() === repoOwner?.toLowerCase(),
    );
    if (configured) return configured;
    const projectId = [...state.items.values()].find(
      (row) => row.present && row.item.contentNodeId === id && bound.has(row.projectId),
    )?.projectId;
    return bound.get(projectId ?? "")!.owner;
  }
  async function baselines(items: readonly ObservedItem[]) {
    const state = mirror.read();
    const grouped = new Map<string, Set<string>>();
    for (const value of items)
      if (
        value.issue &&
        (!state.issues.get(value.issue.nodeId)?.baselined ||
          !state.issues.get(value.issue.nodeId)?.present)
      ) {
        const repositoryOwner = value.issue.repository.split("/")[0]!;
        const owner =
          Object.keys(options.configuration.owners).find(
            (login) => login.toLowerCase() === repositoryOwner.toLowerCase(),
          ) ?? bound.get(value.projectId)!.owner;
        const ids = grouped.get(owner) ?? new Set();
        ids.add(value.issue.nodeId);
        grouped.set(owner, ids);
      }
    const values: ObservedIssue[] = [];
    for (const [owner, set] of grouped) {
      const ids = [...set];
      for (let offset = 0; offset < ids.length; offset += 50) {
        const batch = ids.slice(offset, offset + 50);
        const issues = await api.issues(owner, batch);
        if (issues.length !== batch.length)
          throw new GitHubSourceError("api", "Content issue baseline is unavailable");
        values.push(...issues);
      }
    }
    return values;
  }
  function commit(work: (state: MirrorState) => SourceEvent[], completed: readonly Pending[] = []) {
    if (stopped) return;
    options.probe?.();
    const discovered: string[] = [];
    const changed = options.store.connection.transaction(() => {
      const before = mirror.read();
      const after = structuredClone(before);
      const events = work(after).map((event): SourceEvent => {
        if (event.event.type === "github.project-item.removed")
          moves.removed((event.event["item"] as { nodeId: string }).nodeId);
        if (event.event.type === "github.project-item.field-changed") {
          const item = event.event["item"] as { nodeId: string };
          const field = event.event["field"] as { nodeId: string; name: string };
          const project = event.event["project"] as { nodeId: string };
          const to = event.event["to"] as { kind: string; optionId?: string } | null;
          return {
            ...event,
            event: {
              ...event.event,
              movedBy: moves.attribute(
                item.nodeId,
                field.nodeId,
                to?.kind === "single-select" ? to.optionId : undefined,
              ),
              lifecycle: options.lifecycleField?.(project.nodeId) === field.name,
            },
          };
        }
        return event;
      });
      if (options.taskFieldValues) {
        const previous = trackedIssueIndex(before, bound);
        const next = trackedIssueIndex(after, bound);
        for (const [id, issue] of next) {
          const earlier = previous.get(id);
          if (!earlier?.content || !issue.content) continue;
          for (const project of issue.projects) {
            const from = options.taskFieldValues(project.nodeId, earlier);
            const to = options.taskFieldValues(project.nodeId, issue);
            if (!from || !to) continue;
            for (const [field, value] of Object.entries(to)) {
              const old = from[field];
              if (!old || JSON.stringify(old.value) === JSON.stringify(value.value)) continue;
              const item = issue.items.find((item) => item.project.nodeId === project.nodeId);
              const revision =
                value.storage === "project-field"
                  ? [...after.fields.values()].find(
                      (row) =>
                        row.itemId === item?.nodeId &&
                        row.field.name === (value.storageName ?? field),
                    )!.revision
                  : after.issues.get(id)!.contentRevision!;
              const digest = createHash("sha256").update(field).digest("hex").slice(0, 16);
              events.push({
                source: "github",
                eventId: `task-field:${id}:${project.nodeId}:${digest}:${revision}`,
                topics: [`github.issue.${id}`],
                event: {
                  type: "github.task-field.changed",
                  issue: {
                    nodeId: issue.issue.nodeId,
                    repository: issue.issue.repository,
                    number: issue.issue.number,
                    state: issue.issue.state,
                    stateReason: issue.issue.stateReason,
                  },
                  project: { ...project },
                  binding: options.taskFieldBinding?.(project) ?? "",
                  field,
                  storage: value.storage,
                  from: old.value,
                  to: value.value,
                  setBy: taskWrites.attribute(
                    id,
                    project.nodeId,
                    field,
                    value.value.state === "set" ? value.value.value : null,
                  ),
                },
              });
            }
          }
        }
      }
      const mirrorChanged = mirror.write(before, after);
      for (const event of events) {
        if (!validEvent(event.event)) throw new TypeError("Invalid normalized GitHub event");
        if (options.router.publish(event).status === "rejected")
          throw new TypeError("Router rejected a GitHub event");
      }
      for (const event of events) {
        if (event.event.type === "github.project-item.added") {
          const item = event.event["item"] as { contentType: string; contentNodeId: string };
          if (item.contentType === "issue" && mirror.trackedIssue(item.contentNodeId, bound))
            discovered.push(item.contentNodeId);
        }
      }
      for (const row of completed) mirror.complete(row);
      return mirrorChanged;
    });
    if (discovered.length) options.onTracked?.([...new Set(discovered)]);
    if (changed) options.onMirrorChanged?.();
  }
  function compareItems(
    state: MirrorState,
    items: readonly ObservedItem[],
    issues: readonly ObservedIssue[],
  ) {
    const events: SourceEvent[] = [];
    for (const value of items) {
      events.push(...reconcileItem(state, value.item.nodeId, value));
      if (
        value.issue &&
        (!state.issues.get(value.issue.nodeId)?.baselined ||
          !state.issues.get(value.issue.nodeId)?.present)
      ) {
        const baseline = issues.find((row) => row.issue.nodeId === value.issue!.nodeId)!;
        events.push(...reconcileIssue(state, bound, baseline));
      }
    }
    return events;
  }
  async function project(row: Pending) {
    const reference = bound.get(row.nodeId);
    if (!reference) {
      mirror.complete(row);
      return;
    }
    const seen = new Set<string>();
    let after: string | undefined;
    // The Project's comparison first observes its fields, as one observation of its own.
    while (queue.length) {
      if (stopped) return;
      await jobNext();
    }
    await observeFields(reference);
    if (stopped) return;
    do {
      while (queue.length) {
        if (stopped) return;
        await jobNext();
      }
      const page = await api.projectPage(reference, after);
      if (stopped) return;
      const issues = await baselines(page.items);
      commit((state) => [
        ...reconcileProject(state, row.nodeId, page.closed),
        ...compareItems(state, page.items, issues),
      ]);
      for (const id of page.seenIds) seen.add(id);
      if (page.pageInfo.hasNextPage) {
        if (!page.pageInfo.endCursor || page.pageInfo.endCursor === after)
          throw new GitHubSourceError("api", "GitHub Project pagination did not advance");
        after = page.pageInfo.endCursor;
      } else after = undefined;
    } while (after);
    if (stopped) return;
    options.store.connection.transaction(() => {
      const state = mirror.read();
      for (const item of state.items.values())
        if (item.present && item.projectId === row.nodeId) {
          if (!seen.has(item.item.nodeId)) mirror.enqueue("item", item.item.nodeId);
          if (item.item.contentType === "issue") mirror.enqueue("issue", item.item.contentNodeId);
        }
      mirror.complete(row);
    });
  }
  async function pending() {
    const absent = new Set<string>();
    while (true) {
      if (stopped) return;
      if (queue.length) {
        await jobNext();
        continue;
      }
      const rows = mirror
        .pending()
        .filter((row) => row.kind !== "issue" || !absent.has(row.nodeId));
      const first = rows[0];
      if (!first) return;
      const state = mirror.read();
      if (first.kind === "project") {
        await project(first);
        continue;
      }
      if (first.kind === "issue") {
        if (!isTracked(state, bound, first.nodeId)) {
          mirror.complete(first);
          continue;
        }
        const owner = credentialOwner(state, first.nodeId);
        const batch = rows
          .filter(
            (row) =>
              row.kind === "issue" &&
              isTracked(state, bound, row.nodeId) &&
              credentialOwner(state, row.nodeId) === owner,
          )
          .slice(0, 50);
        const issues = await api.issues(
          owner,
          batch.map((row) => row.nodeId),
        );
        const observed = new Set(issues.map((value) => value.issue.nodeId));
        const missing = batch.filter((row) => !observed.has(row.nodeId));
        commit(
          (view) => {
            const events = issues.flatMap((value) => reconcileIssue(view, bound, value));
            for (const row of missing)
              view.issues.set(row.nodeId, { ...view.issues.get(row.nodeId)!, present: false });
            return events;
          },
          batch.filter((row) => observed.has(row.nodeId)),
        );
        for (const row of missing) absent.add(row.nodeId);
      } else {
        const projectId = first.projectId ?? state.items.get(first.nodeId)?.projectId;
        if (!projectId || !bound.has(projectId)) {
          mirror.complete(first);
          continue;
        }
        const owner = bound.get(projectId)!.owner;
        const batch = rows
          .filter(
            (row) =>
              row.kind === "item" &&
              bound.get(row.projectId ?? state.items.get(row.nodeId)?.projectId ?? "")?.owner ===
                owner,
          )
          .slice(0, 50);
        const values = await api.items(
          owner,
          batch.map((row) => row.nodeId),
        );
        const items = values.filter(
          (value): value is ObservedItem =>
            value !== undefined && "item" in value && bound.has(value.projectId),
        );
        const issues = await baselines(items);
        commit((view) => {
          const events: SourceEvent[] = [];
          for (let i = 0; i < batch.length; i++) {
            const value = values[i];
            if (value && (!("item" in value) || !bound.has(value.projectId))) continue;
            if (value && "item" in value) events.push(...compareItems(view, [value], issues));
            else events.push(...reconcileItem(view, batch[i]!.nodeId, undefined));
          }
          return events;
        }, batch);
      }
    }
  }
  async function jobNext() {
    const queued = queue.shift()!;
    const { signal } = queued;
    queued.detach();
    if (signal?.aborted) {
      queued.reject(signal.reason);
      return;
    }
    if (queued.kind === "operation") {
      try {
        await queued.run();
      } catch (error) {
        queued.reject(signal?.aborted ? signal.reason : error);
      }
      return;
    }
    if (queued.kind === "move") return moveJob(queued);
    if (queued.kind === "observe") return observeJob(queued);
    return writeJob(queued);
  }
  async function moveJob(queued: Extract<Job, { kind: "move" }>) {
    const { move, signal } = queued;
    try {
      const state = mirror.read();
      const project = state.projects.get(move.projectNodeId)?.project;
      const item = [...state.items.values()].find(
        (row) =>
          row.present &&
          row.projectId === move.projectNodeId &&
          row.item.contentType === "issue" &&
          row.item.contentNodeId === move.issueNodeId,
      );
      if (!project || !item)
        throw new GitHubWriteError("item-missing", "Issue item is absent from the Project");
      const resolved = await api.projectField(
        project.owner,
        project.nodeId,
        move.field,
        move.option,
        signal,
      );
      if (stopped) return;
      signal?.throwIfAborted();
      const inserted = options.store.connection.transaction(() =>
        moves.sent(move, item.item.nodeId, resolved.field, resolved.option),
      );
      try {
        await api.moveCard(
          project.owner,
          project.nodeId,
          item.item.nodeId,
          resolved.field,
          resolved.option,
          signal,
        );
      } catch (error) {
        if (stopped) return;
        if (inserted && error instanceof GitHubWriteError && error.kind !== "transport")
          options.store.connection.transaction(() =>
            moves.refused(move, resolved.field, resolved.option),
          );
        throw error;
      }
      if (stopped) return;
      options.store.connection.transaction(() => {
        moves.confirmed(move, resolved.field, resolved.option);
        mirror.enqueue("item", item.item.nodeId, project.nodeId);
      });
      options.probeMove?.(move);
      queued.resolve();
    } catch (error) {
      if (!stopped) queued.reject(signal?.aborted ? signal.reason : error);
    }
  }
  async function observeJob(queued: Extract<Job, { kind: "observe" }>) {
    const { projectNodeId, signal } = queued;
    try {
      const project =
        mirror.read().projects.get(projectNodeId)?.project ?? bound.get(projectNodeId);
      if (!project)
        throw new GitHubWriteError("field-missing", "Project is absent from the mirror");
      const fields = await observeFields(project, signal);
      if (stopped) return;
      queued.resolve(fields);
    } catch (error) {
      if (!stopped) queued.reject(signal?.aborted ? signal.reason : classifyWriteError(error));
    }
  }
  async function writeJob(queued: Extract<Job, { kind: "write" }>) {
    const { write, signal } = queued;
    try {
      const project =
        mirror.read().projects.get(write.projectNodeId)?.project ?? bound.get(write.projectNodeId);
      if (!project)
        throw new GitHubWriteError("field-missing", "Project is absent from the mirror");
      const field = await api.writeField(project.owner, write, signal);
      if (stopped) return;
      signal?.throwIfAborted();
      options.probeFieldWrite?.(write);
      let changed = false;
      options.store.connection.transaction(() => {
        if (field) changed = mirror.writeFieldRow(write.projectNodeId, field);
        else if (write.kind === "delete")
          changed = mirror.deleteFieldRow(write.projectNodeId, write.fieldNodeId);
      });
      if (changed) options.onMirrorChanged?.();
      queued.resolve(field);
    } catch (error) {
      if (!stopped) queued.reject(signal?.aborted ? signal.reason : classifyWriteError(error));
    }
  }
  async function scan() {
    for (const [owner, configuration] of Object.entries(options.configuration.owners))
      for (const hook of configuration.hooks) {
        if (stopped) return;
        const cursor = mirror.scanCursor(hook.id);
        if (cursor === undefined) {
          mirror.saveCursor(hook.id, clock.now());
          continue;
        }
        const attempts: Awaited<ReturnType<typeof api.deliveries>>["attempts"] = [];
        let nextCursor: string | undefined;
        const seenCursors = new Set<string>();
        let newest = cursor;
        while (true) {
          if (stopped) return;
          await drainJobs();
          if (stopped) return;
          const page = await api.deliveries(owner, hook, nextCursor);
          const deliveries = page.attempts;
          let older = false;
          for (const delivery of deliveries) {
            const time = Date.parse(delivery.delivered_at);
            if (!Number.isFinite(time))
              throw new GitHubSourceError("api", "Invalid GitHub delivery timestamp");
            if (time < cursor) older = true;
            else {
              attempts.push(delivery);
              newest = Math.max(newest, time);
            }
          }
          if (older || !page.nextCursor) break;
          if (seenCursors.has(page.nextCursor))
            throw new GitHubSourceError("api", "GitHub delivery cursor did not advance");
          seenCursors.add(page.nextCursor);
          nextCursor = page.nextCursor;
        }
        const grouped = new Map<string, typeof attempts>();
        for (const attempt of attempts) {
          const values = grouped.get(attempt.guid) ?? [];
          values.push(attempt);
          grouped.set(attempt.guid, values);
        }
        for (const [id, values] of grouped)
          if (
            !values.some((value) => value.status_code >= 200 && value.status_code < 300) &&
            !mirror.hasDelivery(id) &&
            !mirror.hasRedelivery(id)
          ) {
            const latest = values.reduce((a, b) =>
              Date.parse(a.delivered_at) >= Date.parse(b.delivered_at) ? a : b,
            );
            await drainJobs();
            if (stopped) return;
            await api.redeliver(owner, hook, latest.id);
            if (stopped) return;
            mirror.redelivered(id, hook.id, latest.id);
          }
        if (!stopped) mirror.saveCursor(hook.id, newest);
      }
  }
  async function run() {
    while (wakeRequested) {
      if (stopped) return;
      wakeRequested = false;
      await drainJobs();
      if (stopped) return;
      if (scanDue) {
        scanDue = false;
        try {
          await scan();
        } catch (error) {
          report(error);
        } finally {
          if (!stopped) {
            cancelScan?.();
            cancelScan = clock.setTimer(options.configuration.redeliveryIntervalMs, () => {
              scanDue = true;
              wake();
            });
          }
        }
      }
      let swept = false;
      if (sweepDue && !stopped) {
        sweepDue = false;
        swept = true;
        try {
          await rebuild();
          if (!stopped) {
            options.store.connection.transaction(() => {
              for (const id of bound.keys()) mirror.enqueue("project", id);
            });
            for (const scope of options.scopes?.() ?? []) await scopeObservation(scope);
            pull();
          }
        } catch (error) {
          report(error);
        }
      }
      if (!stopped)
        try {
          await pending();
        } catch (error) {
          report(error);
          wakeRequested = scanDue || sweepDue || queue.length > 0;
        }
      if (swept && !stopped) {
        cancelSweep?.();
        cancelSweep = clock.setTimer(options.configuration.sweepIntervalMs, () => {
          sweepDue = true;
          wake();
        });
      }
    }
  }
  function wake() {
    if (stopped) return;
    wakeRequested = true;
    if (!running)
      running = Promise.resolve()
        .then(run)
        .finally(() => {
          running = undefined;
          if (wakeRequested && !stopped) wake();
        });
  }
  function serial<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (stopped)
      return Promise.reject(new GitHubWriteError("transport", "GitHub source is stopped"));
    if (signal?.aborted) return Promise.reject(signal.reason);
    return new Promise<T>((resolve, reject) => {
      const aborted = () => {
        const index = queue.indexOf(job);
        if (index >= 0) {
          queue.splice(index, 1);
          job.detach();
          reject(signal?.reason);
        }
      };
      const job: Job = {
        kind: "operation",
        signal,
        reject,
        detach: () => signal?.removeEventListener("abort", aborted),
        run: async () => resolve(await work()),
      };
      queue.push(job);
      signal?.addEventListener("abort", aborted, { once: true });
      wake();
    });
  }
  async function scopeObservation(
    scope: StorageScope,
    signal?: AbortSignal,
  ): Promise<ScopeConfiguration> {
    const owner =
      scope.kind === "organization" ? scope.organization : scope.repository.split("/")[0]!;
    const configured = Object.keys(options.configuration.owners).some(
      (login) => login.toLowerCase() === owner.toLowerCase(),
    );
    const observed: ScopeConfiguration = !configured
      ? {
          scope,
          status: "unconfigured",
          message: `GitHub owner is not configured: ${owner}`,
          readAt: clock.now(),
        }
      : options.storageAdapters
        ? await options.storageAdapters.observeScope(scope, signal)
        : {
            scope,
            status: "unsupported",
            message: "Storage adapter is unavailable",
            readAt: clock.now(),
          };
    options.store.connection.transaction(() => mirror.observeScope(observed));
    return observed;
  }
  wake();
  return {
    bound,
    observeScope: (scope: StorageScope, signal?: AbortSignal) =>
      serial(() => scopeObservation(scope, signal), signal),
    writeScopeEntity: (write: ScopeEntityWrite, signal?: AbortSignal) =>
      serial(async () => {
        if (!options.storageAdapters)
          throw new GitHubWriteError("unavailable", "Storage adapter is unavailable");
        const entity = await options.storageAdapters.writeScopeEntity(write, signal);
        const scope: StorageScope =
          "organization" in write
            ? { kind: "organization", organization: write.organization }
            : { kind: "repository", repository: write.repository };
        await scopeObservation(scope, signal);
        return entity;
      }, signal),
    writeTaskField: (write: TaskFieldWrite, signal?: AbortSignal) =>
      serial(async () => {
        const issue = mirror.trackedIssueIndex(bound).get(write.issueNodeId);
        const project = issue?.projects.find((project) => project.nodeId === write.projectNodeId);
        if (!issue || !project)
          throw new GitHubWriteError("item-missing", "Issue item is absent from the Project");
        const storage = write.storage;
        const row = taskWrites.row(write);
        if (
          row &&
          (row["field"] !== write.field ||
            row["value"] !== JSON.stringify(write.value) ||
            row["storage"] !== JSON.stringify(storage))
        )
          throw new GitHubWriteError(
            "rejected",
            "Invocation already owns another task field write",
          );
        taskWrites.sent(write, clock.now());
        try {
          if (storage.kind === "front-matter") {
            const owner = issue.issue.repository.split("/")[0]!;
            await writeBody(write, taskWrites, {
              read: () => api.readBody(owner, write.issueNodeId, signal),
              write: (body) => api.writeBody(owner, write.issueNodeId, body, signal),
              edits: () => api.bodyEdits(owner, write.issueNodeId, signal),
            });
          } else if (storage.kind === "project-field") {
            const fields = await api.projectFields(project, signal);
            const field = fields.find((field) => field.name === storage.name);
            const item = issue.items.find((item) => item.project.nodeId === project.nodeId);
            if (!field || !item) throw new GitHubWriteError("missing", "Task field is absent");
            let value: Record<string, unknown> | null = null;
            if (write.value !== null) {
              if (field.type === "single-select") {
                const option = field.options.find((option) => option.name === write.value);
                if (!option) throw new GitHubWriteError("missing", "Task field option is absent");
                value = { singleSelectOptionId: option.id };
              } else if (field.type === "text" || field.type === "number" || field.type === "date")
                value = { [field.type]: write.value };
              else throw new GitHubWriteError("unavailable", "Task field type is unsupported");
            }
            await api.setProjectValue(
              project.owner,
              project.nodeId,
              item.nodeId,
              field.nodeId,
              value,
              signal,
            );
            mirror.enqueue("item", item.nodeId, project.nodeId);
          } else {
            if (!options.storageAdapters)
              throw new GitHubWriteError("unavailable", "Storage adapter is unavailable");
            await options.storageAdapters.writeTaskField(write, issue, signal);
          }
        } catch (error) {
          if (error instanceof GitHubWriteError && error.kind !== "transport")
            taskWrites.status(write, "refused");
          throw classifyWriteError(error);
        }
        taskWrites.status(write, "confirmed");
        mirror.enqueue("issue", write.issueNodeId);
        options.probeTaskFieldWrite?.(write);
      }, signal),
    moveCard(move: CardMove, signal?: AbortSignal): Promise<void> {
      if (stopped) throw new TypeError("GitHub source is stopped");
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise<void>((resolve, reject) => {
        const aborted = () => {
          const index = queue.indexOf(queued);
          if (index >= 0) {
            queue.splice(index, 1);
            queued.detach();
            reject(signal?.reason);
          }
        };
        const queued: Job = {
          kind: "move",
          move: { ...move },
          signal,
          resolve,
          reject,
          detach: () => signal?.removeEventListener("abort", aborted),
        };
        queue.push(queued);
        signal?.addEventListener("abort", aborted, { once: true });
        wake();
      });
    },
    observeProjectFields(projectNodeId: string, signal?: AbortSignal): Promise<ProjectFields> {
      if (stopped) throw new TypeError("GitHub source is stopped");
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise<ProjectFields>((resolve, reject) => {
        const aborted = () => {
          const index = queue.indexOf(queued);
          if (index >= 0) {
            queue.splice(index, 1);
            queued.detach();
            reject(signal?.reason);
          }
        };
        const queued: Job = {
          kind: "observe",
          projectNodeId,
          signal,
          resolve,
          reject,
          detach: () => signal?.removeEventListener("abort", aborted),
        };
        queue.push(queued);
        signal?.addEventListener("abort", aborted, { once: true });
        wake();
      });
    },
    writeProjectField(
      write: ProjectFieldWrite,
      signal?: AbortSignal,
    ): Promise<ProjectField | undefined> {
      if (stopped) throw new TypeError("GitHub source is stopped");
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise<ProjectField | undefined>((resolve, reject) => {
        const aborted = () => {
          const index = queue.indexOf(queued);
          if (index >= 0) {
            queue.splice(index, 1);
            queued.detach();
            reject(signal?.reason);
          }
        };
        const queued: Job = {
          kind: "write",
          write: structuredClone(write),
          signal,
          resolve,
          reject,
          detach: () => signal?.removeEventListener("abort", aborted),
        };
        queue.push(queued);
        signal?.addEventListener("abort", aborted, { once: true });
        wake();
      });
    },
    wake,
    pull,
    requestSweep() {
      if (stopped) throw new TypeError("GitHub source is stopped");
      sweepDue = true;
      cancelSweep?.();
      wake();
    },
    async stop() {
      if (stopped) {
        await running;
        return;
      }
      stopped = true;
      for (const queued of queue.splice(0)) {
        queued.detach();
        if (queued.kind !== "move")
          queued.reject(new GitHubWriteError("transport", "GitHub source is stopped"));
      }
      cancelScan?.();
      cancelSweep?.();
      api.abort();
      await running;
    },
    isStopped: () => stopped,
  };
}
