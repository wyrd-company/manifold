// ---
// relationships:
//   implements: agent-tools
// ---
import { setTimeout as sleep } from "node:timers/promises";
import type { OrchestrationThread } from "@wyrd-company/t3code-client";
import { callId } from "./calls.ts";
import { refuse } from "./types.ts";
import type { AgentToolsOptions, CallRequest, Identity } from "./types.ts";
function activityTurn(thread: OrchestrationThread | null, id: string) {
  return thread?.activities.find(
    (activity) =>
      activity.kind.startsWith("tool.") &&
      activity.payload !== null &&
      typeof activity.payload === "object" &&
      "toolCallId" in activity.payload &&
      activity.payload.toolCallId === id &&
      activity.turnId,
  )?.turnId;
}
export async function identify(
  options: AgentToolsOptions,
  request: CallRequest,
  stopping: AbortSignal,
): Promise<Identity> {
  const signal = AbortSignal.any([
    stopping,
    AbortSignal.timeout(options.configuration.identifyTimeoutMs),
  ]);
  const now = options.clock?.now ?? Date.now;
  const until = now() + options.configuration.identifyTimeoutMs;
  let environmentId: string;
  try {
    environmentId = await options.environmentId(request.environment, signal);
  } catch (error) {
    if (stopping.aborted) throw error;
    return refuse(
      "environment-unavailable",
      "The environment is not ready. Call again in this turn safely.",
      503,
    );
  }
  const followed = options.actors().followedThreads(request.environment);
  const id = callId(request.meta);
  const latest = new Map<string, OrchestrationThread | null>();
  let outsider = false;
  if (id) {
    const outside = options.threads.runningThreads(request.environment, signal).then(
      (threads) => {
        outsider = threads.some(
          (thread) => !followed.includes(thread.id) && activityTurn(thread, id),
        );
      },
      () => {},
    );
    while (!signal.aborted && now() < until) {
      const matches = await Promise.all(
        followed.map(async (threadId) => {
          try {
            const thread = await options.threads.readThread(request.environment, threadId, signal);
            latest.set(threadId, thread);
            const turnId = activityTurn(thread, id);
            return turnId ? { threadId, turnId: String(turnId) } : undefined;
          } catch {
            return undefined;
          }
        }),
      );
      const found = matches.filter((match) => match !== undefined);
      if (found.length === 1)
        return { environment: request.environment, environmentId, ...found[0]! };
      try {
        if (options.clock) await options.clock.sleep(100, signal);
        else await sleep(100, undefined, { signal });
      } catch {
        break;
      }
    }
    await outside;
  }
  stopping.throwIfAborted();
  const fallback = request.arguments["thread"];
  if (typeof fallback === "string") {
    if (!followed.includes(fallback))
      return refuse("not-followed", "No active task follows this thread.");
    try {
      const thread = latest.has(fallback)
        ? latest.get(fallback)
        : await options.threads.readThread(request.environment, fallback, signal);
      if (thread?.session?.status === "running" && thread.session.activeTurnId)
        return {
          environment: request.environment,
          environmentId,
          threadId: fallback,
          turnId: String(thread.session.activeTurnId),
        };
    } catch {
      /* Refusal leaves this call safe to repeat. */
    }
  }
  if (outsider) return refuse("not-followed", "No active task follows the calling thread.");
  return refuse(
    "caller-unidentified",
    "The caller could not be identified. Supply the thread id and call again in this turn safely.",
  );
}
