// ---
// relationships:
//   implements: operator-console
// ---
import type { DeclarationLint } from "../../api/portfolio-declarations-stand-in.ts";
export function ProblemsList({ lint }: { lint: DeclarationLint | undefined }) {
  return lint ? (
    <div className="portfolio-problems">
      {[...lint.findings.map((f) => ({ ...f, severity: "error" })), ...lint.warnings].map((f) => (
        <p
          key={`${f.file}:${f.location}:${f.kind}:${f.message}`}
          className={f.severity === "warning" ? "warning-text" : "error-text"}
        >
          <code>{f.kind}</code>{" "}
          <code>
            {f.file}
            {f.location}
          </code>{" "}
          {f.message}
        </p>
      ))}
    </div>
  ) : null;
}
