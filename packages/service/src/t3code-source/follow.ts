// ---
// relationships:
//   implements: t3code-environment-source
// ---
import type { OrchestrationThread } from "@wyrd-company/t3code-client";
import type { ThreadRow } from "./persistence.ts";
import { threadState } from "./state.ts";
export function needsSubscription(row: ThreadRow, sequence: number) {
  return !row.thread || row.cursor < sequence;
}
export function canClose(thread: OrchestrationThread, synchronized: boolean, catchup: boolean) {
  if (!synchronized) return false;
  if (catchup) return true;
  const state = threadState(thread);
  return (
    state.turn?.state !== "running" &&
    state.session?.status !== "starting" &&
    state.session?.status !== "running" &&
    state.requests.length === 0
  );
}
