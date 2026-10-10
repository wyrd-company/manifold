// ---
// relationships:
//   implements: operator-console
// ---
import type {
  EnvironmentSummary,
  EnvironmentAction,
} from "@wyrd-company/manifold-shared/environments-api";
export function environmentRow(environment: EnvironmentSummary) {
  const failed = environment.connection !== "connected" && !!environment.error;
  return {
    status: {
      label: failed
        ? "Error"
        : environment.connection === "connected"
          ? "Connected"
          : environment.connection === "connecting"
            ? "Connecting"
            : "Disconnected",
      dot: failed
        ? "error"
        : environment.connection === "connected"
          ? "connected"
          : environment.connection === "connecting"
            ? "connecting"
            : "disconnected",
      detail: failed ? environment.error : undefined,
      paused: environment.paused,
    },
    activeThreads: environment.activeThreads ?? "—",
    scheduledThreads: environment.scheduledThreads,
    pause: environment.paused
      ? { label: "Resume", action: "resume" as EnvironmentAction }
      : { label: "Pause", action: "pause" as EnvironmentAction },
    connection:
      environment.connection === "disconnected"
        ? { label: "Reconnect", action: "reconnect" as EnvironmentAction }
        : { label: "Disconnect", action: "disconnect" as EnvironmentAction },
  };
}
export function environmentsCaption(environments: readonly EnvironmentSummary[]) {
  return `${environments.length} ${environments.length === 1 ? "environment" : "environments"} · ${environments.filter((e) => e.connection === "connected").length} connected · ${environments.filter((e) => e.paused).length} paused`;
}
