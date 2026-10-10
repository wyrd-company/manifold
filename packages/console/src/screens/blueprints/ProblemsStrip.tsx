// ---
// relationships:
//   implements: operator-console
// ---
import type { ApiFinding, GraphState } from "@wyrd-company/manifold-shared/blueprints-api";
import { findingState } from "./problems.ts";
export function ProblemsStrip({
  findings,
  warnings,
  states,
  checking,
  failed,
  onRetry,
  onSelect,
}: {
  findings: readonly ApiFinding[];
  warnings: readonly ApiFinding[];
  states: readonly GraphState[];
  checking: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelect: (finding: ApiFinding) => void;
}) {
  return (
    <details className="blueprint-problems" open={findings.length > 0 || warnings.length > 0}>
      <summary>
        <span className="error-text">{findings.length} errors</span> ·{" "}
        <span className="warning-text">{warnings.length} warnings</span>{" "}
        {checking ? <span className="muted">Checking…</span> : null}
        {failed ? (
          <span role="alert">
            Cannot check this text. <button onClick={onRetry}>Try again</button>
          </span>
        ) : null}
      </summary>
      {[...findings, ...warnings].map((finding) => (
        <button
          className="blueprint-finding"
          key={`${finding["file"] ?? ""}:${finding.location}:${finding.kind}:${finding.message}`}
          onClick={() => onSelect(finding)}
        >
          <span className="mono">{finding.kind}</span> {finding.message}{" "}
          <span className="mono muted">
            {typeof finding["file"] === "string" ? `${finding["file"]} · ` : ""}
            {findingState(finding, states) ?? finding.location}
            {finding.range ? ` · line ${finding.range.line}` : ""}
          </span>
        </button>
      ))}
    </details>
  );
}
