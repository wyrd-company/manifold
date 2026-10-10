// ---
// relationships:
//   implements: operator-console
// ---
import type { ActorTimeline, TimelineRow } from "./actor-model.ts";
export const durationLabel = (ms: number) =>
  ms < 1000
    ? `${Math.round(ms)} ms`
    : ms < 60000
      ? `${(ms / 1000).toFixed(1)} s`
      : ms < 3600000
        ? `${(ms / 60000).toFixed(1)} min`
        : `${(ms / 3600000).toFixed(1)} h`;
export function TimelineBar({
  timeline,
  rows = timeline.rows,
}: {
  timeline: ActorTimeline;
  rows?: readonly TimelineRow[];
}) {
  return (
    <div className="actor-mini-bar" role="img" aria-label="Actor timeline">
      {rows.map((row) => (
        <span
          key={row.visit}
          className={`actor-segment tone-${row.tone}`}
          style={{
            left: `${(100 * (row.start - timeline.start)) / Math.max(1, timeline.duration)}%`,
            width: `${(100 * (row.end - row.start)) / Math.max(1, timeline.duration)}%`,
          }}
          title={`${row.states.join(", ")} · ${durationLabel(row.end - row.start)} · ${new Date(row.start).toLocaleString()}`}
        />
      ))}
    </div>
  );
}
