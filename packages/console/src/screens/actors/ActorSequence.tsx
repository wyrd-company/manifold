// ---
// relationships:
//   implements: operator-console
// ---
import type { ActorSequence as Sequence } from "./actor-model.ts";
import { ActorUsageLabel } from "./ActorTimeline.tsx";
export function ActorSequence({ sequence }: { sequence: Sequence }) {
  const columns = sequence.lifelines.length;
  return (
    <div className="actor-sequence-scroll">
      <div
        className="actor-sequence"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(160px, 1fr)) 150px` }}
      >
        {sequence.lifelines.map((l) => (
          <div className="actor-lifeline-header" key={l.id}>
            {l.label}
          </div>
        ))}
        <div className="actor-lifeline-header">Usage</div>
        {sequence.messages.map((m) => {
          const from = sequence.lifelines.findIndex((l) => l.id === m.from) + 1,
            to = sequence.lifelines.findIndex((l) => l.id === m.to) + 1;
          return (
            <div
              className="actor-sequence-row"
              key={m.id}
              style={{
                gridColumn: "1 / -1",
                gridTemplateColumns: `repeat(${columns}, minmax(160px, 1fr)) 150px`,
              }}
            >
              {sequence.lifelines.map((l, index) => (
                <span key={l.id} className="actor-lifeline" style={{ gridColumn: index + 1 }} />
              ))}
              <div
                className={`actor-message message-${m.style} tone-text-${m.tone} ${from > to ? "message-left" : ""}`}
                style={{ gridColumn: `${Math.min(from, to)} / ${Math.max(from, to) + 1}` }}
                title={new Date(m.at).toLocaleString()}
              >
                {m.pass ? <small>pass {m.pass} · </small> : null}
                <span>{m.label}</span>
                {m.style === "solid" || m.style === "dashed" ? (
                  <span className="actor-arrow">{from > to ? "←" : "→"}</span>
                ) : null}
              </div>
              <div className="actor-message-usage" style={{ gridColumn: columns + 1 }}>
                {m.tokens !== undefined ? (
                  <ActorUsageLabel
                    tokens={m.tokens}
                    unmetered={m.unmetered ?? 0}
                    accounts={m.accounts ?? []}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        {sequence.unattributed.tokens > 0 || sequence.unattributed.unmetered > 0 ? (
          <div className="actor-unattributed" style={{ gridColumn: "1 / -1" }}>
            Not in a pass <ActorUsageLabel {...sequence.unattributed} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
