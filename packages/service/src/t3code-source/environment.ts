// ---
// relationships:
//   implements: t3code-environment-source
// ---
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import {
  T3Client,
  T3NotFoundError,
  T3RpcError,
  T3DecodeError,
  watchThread,
  applyThreadEvent,
  threadId,
} from "@wyrd-company/t3code-client";
import type { OrchestrationThread } from "@wyrd-company/t3code-client";
import type { RoutedEvent } from "../router/index.ts";
import {
  compactThread,
  threadState,
  threadChanges,
  snapshotAttribution,
  eventAttribution,
  emptyAttribution,
  snapshotPlacements,
  eventPlacements,
} from "./state.ts";
import { retryDelay } from "./retry.ts";
import { needsSubscription, canClose } from "./follow.ts";
import { sourceEvent, threadTopic } from "./events.ts";
import { createdProjects } from "./created-projects.ts";
import { persistence, SourceDefect } from "./persistence.ts";
import type { T3CodeSourceOptions, EnvironmentStatus, T3CodeProjectView } from "./types.ts";
export function environmentLoop(
  options: T3CodeSourceOptions,
  environment: string,
  signal: AbortSignal,
  onReady: () => void,
  onNotReady: (identityChanged?: boolean) => Promise<void>,
) {
  let projects: Omit<T3CodeProjectView, "activeThreads">[] | undefined;
  let projectSequence = -1;
  let platform: "darwin" | "linux" | "windows" | "unknown" = "unknown";
  const configuration = options.environments[environment]!;
  const stored = persistence(options.store, environment);
  const records = createdProjects(options.store);
  const status: {
    environment: string;
    state: EnvironmentStatus["state"];
    error?: string;
    followedThreads: number;
    activeThreads: number;
    openSubscriptions: number;
  } = {
    environment,
    state: "connecting",
    followedThreads: 0,
    activeThreads: 0,
    openSubscriptions: 0,
  };
  const log = (message: string, thread?: string) =>
    options.logger?.warn(message, { environment, ...(thread ? { thread } : {}) });
  function validId(id: string) {
    try {
      threadTopic(environment, id);
      return true;
    } catch {
      log("Skipping malformed thread identity", id);
      return false;
    }
  }
  const countThreads = () => {
    const followed = stored.rows().filter((row) => row.status === "followed");
    status.followedThreads = followed.length;
    status.activeThreads = followed.filter(
      (row) =>
        row.thread &&
        (threadState(row.thread).turn?.state === "running" ||
          row.thread.session?.status === "starting" ||
          row.thread.session?.status === "running"),
    ).length;
  };
  const run = async () => {
    let attempt = 0;
    while (!signal.aborted && status.state !== "stopped") {
      countThreads();
      const hold = options.holds?.held(environment);
      if (hold?.disconnected) {
        status.state = "disconnected";
        await onNotReady(false);
        await options.holds!.changed(environment, hold.sequence, signal).catch(() => {});
        attempt = 0;
        continue;
      }
      const lifetime = new AbortController();
      const abort = () => lifetime.abort();
      signal.addEventListener("abort", abort, { once: true });
      let operatorDisconnect = false;
      const watchHolds = async () => {
        if (!options.holds || !hold) return;
        let sequence = hold.sequence;
        while (!lifetime.signal.aborted) {
          await options.holds.changed(environment, sequence, lifetime.signal);
          const next = options.holds.held(environment);
          sequence = next.sequence;
          if (next.disconnected) {
            operatorDisconnect = true;
            lifetime.abort();
            await onNotReady(false);
            return;
          }
        }
      };
      const holdWatch = watchHolds().catch(() => {});
      const retainDiagnostic = (data?: Record<string, unknown>) => {
        if (
          (status.state === "connecting" || status.state === "retrying") &&
          data?.["error"] !== undefined
        )
          status.error = String(data["error"]);
      };
      const client = T3Client.create({
        baseUrl: configuration.url,
        backoff: configuration.reconnect,
        pingIntervalMs: configuration.heartbeat.intervalMs,
        missedPongLimit: configuration.heartbeat.missedPongLimit,
        openTimeoutMs: configuration.openTimeoutMs,
        logger: {
          debug(message, data) {
            options.logger?.debug(message, data);
          },
          info(message, data) {
            options.logger?.info(message, data);
          },
          warn(message, data) {
            retainDiagnostic(data);
            options.logger?.warn(message, data);
          },
          error(message, data) {
            retainDiagnostic(data);
            options.logger?.error(message, data);
          },
        },
        credentials: {
          async load() {
            return {
              accessToken: (
                await readFile(options.tokenFile(configuration.credential), "utf8")
              ).trim(),
            };
          },
          async save() {
            throw new Error("Operator credential is read-only");
          },
          async clear() {
            throw new Error("Operator credential is read-only");
          },
        },
      });
      const open = new Map<
        string,
        { abort: AbortController; target: number; done: Promise<void> }
      >();
      let fail: (error: unknown) => void = () => {};
      const failure = new Promise<never>((_resolve, reject) => {
        fail = reject;
      });
      // Mark the promise handled while setup awaits HTTP.
      void failure.catch(() => {});
      let server = "";
      const publish = (id: string, thread: { projectId: string }, change: RoutedEvent) => {
        const result = options.router.publish(
          sourceEvent(environment, server, id, thread.projectId, change),
        );
        if (result.status === "rejected") throw new SourceDefect("Router rejected a thread change");
      };
      const count = () => {
        status.openSubscriptions = open.size;
        countThreads();
      };
      const deleted = (id: string) =>
        stored.atomic(() => {
          const row = stored.row(id);
          if (!row || row.status === "deleted") return;
          if (row.project_id)
            publish(id, { projectId: row.project_id }, { type: "t3.thread.deleted" });
          else log("Deleted thread has no stored project identity", id);
          stored.save(id, "deleted", row.cursor, row.thread);
        });
      const follow = (id: string, target: number, catchup = false) => {
        if (!validId(id)) return;
        const active = open.get(id);
        if (active) {
          active.target = Math.max(active.target, target);
          return active.done;
        }
        const row = stored.row(id);
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        lifetime.signal.addEventListener("abort", onAbort, { once: true });
        const entry = { abort: controller, target, done: Promise.resolve() };
        open.set(id, entry);
        count();
        entry.done = (async () => {
          let synchronized = false;
          let caughtUp = false;
          try {
            for await (const item of watchThread(client.rpc, threadId(id), {
              ...(row?.thread ? { afterSequence: row.cursor } : {}),
              signal: controller.signal,
            })) {
              if (item.kind === "decode-error") {
                log("Skipping undecodable thread item", id);
                continue;
              }
              if (item.kind === "reconnected") synchronized = false;
              if (item.kind === "synchronized") synchronized = true;
              if (item.kind === "event" && "unknown" in item.event && item.event.unknown) continue;
              if (item.kind === "snapshot" || item.kind === "event")
                stored.atomic(() => {
                  const before = stored.row(id);
                  if (
                    item.kind === "event" &&
                    Number("sequence" in item.event ? item.event.sequence : 0) <=
                      (before?.cursor ?? -1)
                  )
                    return;
                  const thread =
                    item.kind === "snapshot"
                      ? item.snapshot.thread
                      : before?.thread
                        ? applyThreadEvent(before.thread, item.event)
                        : null;
                  if (!thread) throw new SourceDefect("Replay has no stored projection");
                  const attribution =
                    item.kind === "snapshot"
                      ? snapshotAttribution(thread, before?.attribution)
                      : eventAttribution(
                          thread,
                          item.event,
                          before?.attribution ?? emptyAttribution,
                        );
                  const placements =
                    item.kind === "snapshot"
                      ? snapshotPlacements(thread, attribution)
                      : eventPlacements(
                          thread,
                          item.event,
                          before?.attribution ?? emptyAttribution,
                          attribution,
                        );
                  for (const placement of placements)
                    options.messagePlaced?.({ environment, threadId: id, ...placement });
                  const compact = compactThread(thread);
                  for (const change of threadChanges(
                    before?.thread ? threadState(before.thread, before.attribution) : undefined,
                    threadState(compact, attribution),
                  ))
                    publish(id, compact, change);
                  stored.save(
                    id,
                    before?.status ?? "followed",
                    item.kind === "snapshot"
                      ? item.snapshot.snapshotSequence
                      : Number("sequence" in item.event ? item.event.sequence : 0),
                    compact,
                    compact.projectId,
                    attribution,
                  );
                });
              count();
              const current = stored.row(id);
              if (current?.thread && canClose(current.thread, synchronized, catchup)) {
                stored.atomic(() =>
                  stored.save(id, current.status, Math.max(current.cursor, target), current.thread),
                );
                caughtUp = true;
                controller.abort();
                break;
              }
            }
          } catch (error) {
            if (controller.signal.aborted && !(error instanceof SourceDefect)) return;
            if (!(error instanceof T3RpcError)) throw error;
            // A thread can disappear between the shell item and its first snapshot.
            try {
              await client.threads.detail(threadId(id), { signal: lifetime.signal });
            } catch (detailError) {
              if (!(detailError instanceof T3NotFoundError)) throw detailError;
              deleted(id);
              return;
            }
            throw error;
          } finally {
            lifetime.signal.removeEventListener("abort", onAbort);
            open.delete(id);
            count();
            const current = stored.row(id);
            if (
              caughtUp &&
              !catchup &&
              !lifetime.signal.aborted &&
              current &&
              current.status === "followed" &&
              current.cursor < entry.target
            )
              follow(id, entry.target);
          }
        })();
        void entry.done.catch(fail);
        return entry.done;
      };
      const remove = async (id: string, sequence: number) => {
        const row = stored.row(id);
        if (!row || row.status === "deleted") return;
        let thread: OrchestrationThread;
        try {
          thread = (await client.threads.detail(threadId(id), { signal: lifetime.signal })).thread;
        } catch (error) {
          if (!(error instanceof T3NotFoundError)) throw error;
          open.get(id)?.abort.abort();
          await open.get(id)?.done;
          deleted(id);
          return;
        }
        // Keep following an archived thread through its final detail events.
        const active = open.get(id);
        active?.abort.abort();
        await active?.done;
        await follow(id, sequence, true);
        if (!thread.archivedAt) return;
        stored.atomic(() => {
          const current = stored.row(id)!;
          publish(id, thread, { type: "t3.thread.archived", archivedAt: thread.archivedAt });
          stored.save(id, "archived", current.cursor, current.thread);
        });
      };
      try {
        status.state = "connecting";
        await client.connect(lifetime.signal);
        const descriptor = await client.server.environment(lifetime.signal);
        platform = descriptor.platform.os;
        server = descriptor.environmentId;
        const previous = stored.environment();
        const baseline = !previous || previous.environment_id !== server;
        if (baseline) await onNotReady(true);
        const model = await client.shell.readModel(lifetime.signal);
        projectSequence = model.snapshotSequence;
        projects = model.projects
          .filter((project) => !project.deletedAt)
          .map(({ id, title, workspaceRoot }) => ({ id, title, workspaceRoot }));
        if (baseline) {
          const pending = new Set(
            stored
              .rows()
              .filter((row) => row.status === "followed" && row.thread === null)
              .map((row) => row.thread_id),
          );
          stored.atomic(() => {
            stored.reset();
            stored.initialize(server, model.snapshotSequence);
            for (const thread of model.threads)
              if (!thread.deletedAt && validId(thread.id))
                stored.save(
                  thread.id,
                  pending.has(thread.id) ? "followed" : thread.archivedAt ? "archived" : "followed",
                  model.snapshotSequence,
                  pending.has(thread.id) ? null : compactThread(thread),
                  thread.projectId,
                  pending.has(thread.id) ? emptyAttribution : snapshotAttribution(thread),
                );
          });
        }
        stored.atomic(() => records.snapshot(environment, model.projects));
        lifetime.signal.throwIfAborted();
        onReady();
        const cursor = stored.environment()!.shell_sequence;
        for (const row of stored.rows())
          if (row.status === "followed") follow(row.thread_id, row.cursor);
        status.state = "following";
        delete status.error;
        attempt = 0;
        count();
        const shell = (async () => {
          for await (const item of client.shell.watch({
            afterSequence: cursor,
            signal: lifetime.signal,
          })) {
            if (item.kind === "decode-error") {
              log("Skipping undecodable shell item");
              continue;
            }
            if (item.kind === "snapshot") {
              projectSequence = item.snapshot.snapshotSequence;
              projects = item.snapshot.projects
                .filter((project) => !project["deletedAt"])
                .map(({ id, title, workspaceRoot }) => ({
                  id,
                  title,
                  workspaceRoot,
                }));
              const present = new Set(item.snapshot.threads.map((t) => t.id));
              for (const row of stored.rows())
                if (row.status === "followed" && !present.has(threadId(row.thread_id)))
                  await remove(row.thread_id, item.snapshot.snapshotSequence);
              stored.atomic(() => {
                for (const thread of item.snapshot.threads)
                  if (validId(thread.id)) {
                    const row = stored.row(thread.id);
                    stored.save(
                      thread.id,
                      "followed",
                      row?.cursor ?? 0,
                      row?.thread ?? null,
                      thread.projectId,
                    );
                  }
                records.snapshot(environment, item.snapshot.projects);
                stored.shell(item.snapshot.snapshotSequence);
              });
              for (const thread of item.snapshot.threads) {
                const row = stored.row(thread.id);
                if (row && needsSubscription(row, item.snapshot.snapshotSequence))
                  follow(thread.id, item.snapshot.snapshotSequence);
              }
            } else if (item.kind === "thread-upserted") {
              if (validId(item.thread.id)) {
                stored.atomic(() => {
                  const row = stored.row(item.thread.id);
                  stored.save(
                    item.thread.id,
                    "followed",
                    row?.cursor ?? 0,
                    row?.thread ?? null,
                    item.thread.projectId,
                  );
                  stored.shell(item.sequence);
                });
                const row = stored.row(item.thread.id)!;
                if (needsSubscription(row, item.sequence)) follow(item.thread.id, item.sequence);
              } else stored.atomic(() => stored.shell(item.sequence));
            } else if (item.kind === "thread-removed") {
              await remove(item.threadId, item.sequence);
              stored.atomic(() => stored.shell(item.sequence));
            } else if (item.kind === "project-upserted" || item.kind === "project-removed") {
              if (projects && item.sequence > projectSequence) {
                projectSequence = item.sequence;
                if (item.kind === "project-upserted") {
                  const { id, title, workspaceRoot } = item.project;
                  projects = [
                    ...projects.filter((project) => project.id !== id),
                    { id, title, workspaceRoot },
                  ];
                } else projects = projects.filter((project) => project.id !== item.projectId);
              }
              stored.atomic(() => {
                records.presence(
                  environment,
                  item.kind === "project-upserted" ? item.project.id : item.projectId,
                  item.kind === "project-upserted" ? "listed" : "removed",
                );
                stored.shell(item.sequence);
              });
            }
            count();
          }
        })();
        await Promise.race([shell, failure]);
      } catch (error) {
        if (!signal.aborted && !operatorDisconnect) {
          status.error = error instanceof Error ? error.message : String(error);
          if (error instanceof SourceDefect || error instanceof T3DecodeError)
            status.state = "stopped";
          else status.state = "retrying";
          log(status.error);
        }
      } finally {
        lifetime.abort();
        await client.close();
        await holdWatch;
        await Promise.allSettled([...open.values()].map((entry) => entry.done));
        signal.removeEventListener("abort", abort);
        status.openSubscriptions = 0;
      }
      if (operatorDisconnect) {
        attempt = 0;
        continue;
      }
      if (!signal.aborted && status.state !== "stopped") {
        const policy = configuration.reconnect;
        const wait = retryDelay(policy, attempt++, Math.random());
        const waiting = new AbortController();
        const waitSignal = AbortSignal.any([signal, waiting.signal]);
        const holdDuringRetry = async () => {
          if (!options.holds) return;
          let current = options.holds.held(environment);
          while (!current.disconnected) {
            await options.holds.changed(environment, current.sequence, waitSignal);
            current = options.holds.held(environment);
          }
        };
        await Promise.race([
          delay(wait, undefined, { signal: waitSignal }).catch(() => {}),
          ...(options.holds ? [holdDuringRetry().catch(() => {})] : []),
        ]);
        waiting.abort();
      }
    }
    status.state = "stopped";
  };
  let done = run();
  let restarting = false;
  return {
    status,
    get done() {
      return done;
    },
    restart() {
      if (status.state !== "stopped" || signal.aborted || restarting) return;
      restarting = true;
      const previous = done;
      status.state = "connecting";
      delete status.error;
      done = previous.then(() => {
        restarting = false;
        status.state = "connecting";
        return run();
      });
    },
    projects: () => projects,
    platform: () => platform,
  };
}
