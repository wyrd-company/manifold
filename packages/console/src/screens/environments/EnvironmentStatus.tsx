// ---
// relationships:
//   implements: operator-console
// ---
import type { environmentRow } from "./rows.ts";
export function EnvironmentStatus({
  status,
}: {
  status: ReturnType<typeof environmentRow>["status"];
}) {
  return (
    <>
      <div className="environment-status">
        <span className={`status-dot environment-${status.dot}`} aria-hidden="true" />
        {status.label}
        {status.paused ? <span className="configuration-badge warning">Paused</span> : null}
      </div>
      {status.detail ? <small className="muted environment-error">{status.detail}</small> : null}
    </>
  );
}
