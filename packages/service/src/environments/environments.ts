// ---
// relationships:
//   implements: environment-control
// ---
import type { EnvironmentSummary } from "@wyrd-company/manifold-shared/environments-api";
import type { Environments, EnvironmentsOptions } from "./types.ts";
import { applyAction, connectionStatus, emptyHold, eventType } from "./holds.ts";
import { holdsStore } from "./store.ts";
import { migrations } from "./migrations.ts";
import { listener } from "./listener.ts";
export function openEnvironments(options: EnvironmentsOptions): Environments {
  options.store.connection.migrate("environment", migrations);
  const stored = holdsStore(options.store);
  const holds = stored.read();
  const names = Object.keys(options.environments);
  const waiters = new Map<string, Set<() => void>>();
  const held: Environments["held"] = (name) => holds.get(name) ?? emptyHold;
  const act: Environments["act"] = (name, action) => {
    if (!Object.hasOwn(options.environments, name))
      throw new TypeError("Environment is not configured");
    const current = held(name),
      next = applyAction(current, action);
    if (next !== current) {
      const at = (options.clock ?? Date.now)();
      options.store.connection.transaction(() => {
        stored.write(name, next, at);
        const result = options.router.publish({
          source: "environment",
          eventId: `${name}/${next.sequence}`,
          topics: [`environment.${name}`],
          event: { type: eventType(action), environment: name, at: new Date(at).toISOString() },
        });
        if (result.status === "rejected") throw new Error("Router rejected an environment action");
      });
      holds.set(name, next);
      for (const wake of waiters.get(name) ?? []) wake();
    }
    if (
      action === "reconnect" &&
      options.status().some((status) => status.environment === name && status.state === "stopped")
    )
      options.restart(name);
    return next;
  };
  const summary = (name: string): EnvironmentSummary => {
    const source = options.status().find((status) => status.environment === name);
    const hold = held(name);
    const { status, connection } = connectionStatus(hold, source);
    return {
      name,
      host: new URL(options.environments[name]!.url).host,
      url: options.environments[name]!.url,
      status,
      connection,
      paused: hold.paused,
      disconnected: hold.disconnected,
      ...(source?.error && (connection === "connecting" || source.state === "stopped")
        ? { error: source.error }
        : {}),
      activeThreads: connection === "connected" ? source!.activeThreads : null,
      scheduledThreads: options.scheduled(name),
    };
  };
  return {
    held,
    act,
    changed(name, after, signal) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      if (held(name).sequence !== after) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const listeners = waiters.get(name) ?? new Set<() => void>();
        waiters.set(name, listeners);
        const detach = () => {
          listeners.delete(wake);
          if (!listeners.size) waiters.delete(name);
          signal?.removeEventListener("abort", abort);
        };
        const wake = () => {
          detach();
          resolve();
        };
        const abort = () => {
          detach();
          reject(signal?.reason);
        };
        listeners.add(wake);
        signal?.addEventListener("abort", abort, { once: true });
      });
    },
    requestListener: listener(options.configurationFile, names, summary, act),
  };
}
