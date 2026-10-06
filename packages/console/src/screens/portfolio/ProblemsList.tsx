// ---
// relationships:
//   implements: operator-console
// ---
import type { LintDeclarationResponse as DeclarationLint } from "@wyrd-company/manifold-shared/declarations-api";
export function ProblemsList({ lint }: { lint: DeclarationLint | undefined }) {
  return lint && (lint.findings.length || lint.warnings.length) ? (
    <div className="portfolio-problems">
      {[
        ...lint.findings.map((f) => ({ ...f, severity: "error" })),
        ...lint.warnings.map((f) => ({ ...f, severity: "warning" })),
      ].map((f) => (
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
