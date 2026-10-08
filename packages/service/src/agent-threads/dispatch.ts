// ---
// relationships:
//   implements: agent-threads
// ---
import { setTimeout as delay } from "node:timers/promises";
import {
  T3ConnectionError,
  T3TimeoutError,
  T3HttpError,
  T3AuthError,
  T3PreconditionError,
} from "@wyrd-company/t3code-client";
import type { AgentThreadsOptions } from "./types.ts";
import { failure } from "./types.ts";
import { retryDelay } from "../t3code-source/retry.ts";
export class PausedAdmission {
  readonly sequence: number;
  constructor(sequence: number) {
    this.sequence = sequence;
  }
}
export async function dispatch<T>(
  options: AgentThreadsOptions,
  environment: string,
  signal: AbortSignal,
  send: () => Promise<T>,
): Promise<T> {
  let attempt = 0;
  while (true) {
    signal.throwIfAborted();
    const hold = options.holds?.held(environment);
    if (hold?.disconnected) {
      await options.holds!.changed(environment, hold.sequence, signal);
      attempt = 0;
      continue;
    }
    try {
      await options.sourceReady(environment, signal);
    } catch (error) {
      signal.throwIfAborted();
      throw failure(
        "environment",
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
            ? String(error.message)
            : String(error),
      );
    }
    signal.throwIfAborted();
    try {
      return await send();
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof PausedAdmission) {
        await options.holds!.changed(environment, error.sequence, signal);
        continue;
      }
      if (
        error instanceof T3ConnectionError ||
        error instanceof T3TimeoutError ||
        (error instanceof T3HttpError && error.status >= 500)
      ) {
        if (options.holds?.held(environment).disconnected) continue;
        options.logger?.warn("Retrying agent thread command", { environment });
        await delay(
          retryDelay(options.environments[environment]!.reconnect, attempt++, Math.random()),
          undefined,
          { signal },
        );
        continue;
      }
      if (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AgentThreadError"
      )
        throw error;
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof T3AuthError) throw failure("unauthorized", message);
      if (error instanceof T3PreconditionError) throw failure("input", message);
      throw failure("rejected", message);
    }
  }
}
