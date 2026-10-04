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
import { compactThread, threadState, threadChanges } from "./state.ts";
import { retryDelay } from "./retry.ts";
import { needsSubscription, canClose } from "./follow.ts";
import { sourceEvent, threadTopic } from "./events.ts";
import { persistence, SourceDefect } from "./persistence.ts";
import type { T3CodeSourceOptions, EnvironmentStatus } from "./types.ts";
export function environmentLoop(
  options: T3CodeSourceOptions,
  environment: string,
  signal: AbortSignal,
) {
  const configuration = options.environments[environment]!;
  const stored = persistence(options.store, environment);
  const status: {
    environment: string;
    state: EnvironmentStatus["state"];
    error?: string;
    followedThreads: number;
    openSubscriptions: number;
  } = { environment, state: "connecting", followedThreads: 0, openSubscriptions: 0 };
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
  const run = async () => {
    let attempt = 0;
    while (!signal.aborted && status.state !== "stopped") {
      const lifetime = new AbortController();
      const abort = () => lifetime.abort();
      signal.addEventListener("abort", abort, { once: true });
      const client = T3Client.create({
        baseUrl: configuration.url,
        backoff: configuration.reconnect,
        pingIntervalMs: configuration.heartbeat.intervalMs,
        missedPongLimit: configuration.heartbeat.missedPongLimit,
        openTimeoutMs: configuration.openTimeoutMs,
        ...(options.logger ? { logger: options.logger } : {}),
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
        status.followedThreads = stored.rows().filter((r) => r.status === "followed").length;
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
                  const compact = compactThread(thread);
                  for (const change of threadChanges(
                    before?.thread ? threadState(before.thread) : undefined,
                    threadState(compact),
                  ))
                    publish(id, compact, change);
                  stored.save(
                    id,
                    before?.status ?? "followed",
                    item.kind === "snapshot"
                      ? item.snapshot.snapshotSequence
                      : Number("sequence" in item.event ? item.event.sequence : 0),
                    compact,
                  );
                });
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
        server = (await client.server.environment(lifetime.signal)).environmentId;
        const previous = stored.environment();
        if (!previous || previous.environment_id !== server) {
          const model = await client.shell.readModel(lifetime.signal);
          stored.atomic(() => {
            stored.reset();
            stored.initialize(server, model.snapshotSequence);
            for (const thread of model.threads)
              if (!thread.deletedAt && validId(thread.id))
                stored.save(
                  thread.id,
                  thread.archivedAt ? "archived" : "followed",
                  model.snapshotSequence,
                  compactThread(thread),
                );
          });
        }
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
            } else if (item.kind === "project-upserted" || item.kind === "project-removed")
              stored.atomic(() => stored.shell(item.sequence));
            count();
          }
        })();
        await Promise.race([shell, failure]);
      } catch (error) {
        if (!signal.aborted) {
          status.error = error instanceof Error ? error.message : String(error);
          if (error instanceof SourceDefect || error instanceof T3DecodeError)
            status.state = "stopped";
          else status.state = "retrying";
          log(status.error);
        }
      } finally {
        lifetime.abort();
        await client.close();
        await Promise.allSettled([...open.values()].map((entry) => entry.done));
        signal.removeEventListener("abort", abort);
        status.openSubscriptions = 0;
      }
      if (!signal.aborted && status.state !== "stopped") {
        const policy = configuration.reconnect;
        const wait = retryDelay(policy, attempt++, Math.random());
        await delay(wait, undefined, { signal }).catch(() => {});
      }
    }
    status.state = "stopped";
  };
  return { status, done: run() };
}
