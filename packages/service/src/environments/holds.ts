// ---
// relationships:
//   implements: environment-control
// ---
import type { EnvironmentHold, EnvironmentStatus } from "../t3code-source/index.ts";
import type { EnvironmentAction } from "./types.ts";
export const emptyHold: EnvironmentHold = Object.freeze({
  paused: false,
  disconnected: false,
  sequence: 0,
});
export function applyAction(hold: EnvironmentHold, action: EnvironmentAction): EnvironmentHold {
  const next = {
    ...hold,
    ...(action === "pause" || action === "resume"
      ? { paused: action === "pause" }
      : { disconnected: action === "disconnect" }),
  };
  return next.paused === hold.paused && next.disconnected === hold.disconnected
    ? hold
    : Object.freeze({ ...next, sequence: hold.sequence + 1 });
}
export function eventType(action: EnvironmentAction) {
  return (
    {
      pause: "environment.paused",
      resume: "environment.resumed",
      disconnect: "environment.disconnected",
      reconnect: "environment.reconnected",
    } as const
  )[action];
}
export function connectionStatus(hold: EnvironmentHold, source: EnvironmentStatus | undefined) {
  const connection =
    hold.disconnected || source?.state === "stopped"
      ? "disconnected"
      : source?.state === "following"
        ? "connected"
        : "connecting";
  return {
    connection,
    status: connection === "disconnected" ? connection : hold.paused ? "paused" : connection,
  } as const;
}
