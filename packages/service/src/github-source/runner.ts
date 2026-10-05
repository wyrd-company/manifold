// ---
// relationships:
//   implements: github-event-source
// ---
import { moveRecords } from "./move-records.ts";
import type { CardMove } from "./types.ts";
import { createGitHubApi } from "./github-api.ts";
import { createMirror } from "./mirror.ts";
import type { Pending } from "./mirror.ts";
import { reconcileIssue, reconcileItem, reconcileProject, isTracked } from "./reconcile.ts";
import type { MirrorState } from "./reconcile.ts";
import { validEvent } from "./verify.ts";
import { GitHubSourceError, GitHubWriteError } from "./types.ts";
import type { GitHubSourceOptions, GitHubProject, ObservedIssue, ObservedItem } from "./types.ts";
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
  const queue: {
    move: CardMove;
    signal: AbortSignal | undefined;
    resolve: () => void;
    reject: (error: unknown) => void;
    detach: () => void;
  }[] = [];
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
  async function rebuild() {
    const next = new Map<string, GitHubProject>();
    for (const reference of options.boundProjects()) {
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
          const field = event.event["field"] as { nodeId: string };
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
            },
          };
        }
        return event;
      });
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
    do {
      while (queue.length) {
        if (stopped) return;
        await moveNext();
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
        await moveNext();
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
  async function moveNext() {
    const queued = queue.shift()!;
    const { move, signal } = queued;
    queued.detach();
    if (signal?.aborted) {
      queued.reject(signal.reason);
      return;
    }
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
          options.store.connection.transaction(() => moves.refused(move));
        throw error;
      }
      if (stopped) return;
      options.store.connection.transaction(() => {
        moves.confirmed(move);
        mirror.enqueue("item", item.item.nodeId, project.nodeId);
      });
      options.probeMove?.(move);
      queued.resolve();
    } catch (error) {
      if (!stopped) queued.reject(signal?.aborted ? signal.reason : error);
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
  wake();
  return {
    bound,
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
        const queued = {
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
      for (const queued of queue.splice(0)) queued.detach();
      cancelScan?.();
      cancelSweep?.();
      api.abort();
      await running;
    },
    isStopped: () => stopped,
  };
}
