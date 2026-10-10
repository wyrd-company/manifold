// ---
// relationships:
//   implements: operator-console
// ---
import { parse } from "yaml";
import { isDecisionModelPath } from "@wyrd-company/manifold-shared/declarations-api";
import { useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDecisionModel } from "../../../api/declarations.ts";
import { Button } from "../../../ui/button.tsx";
import { ModelDraftContext } from "./ModelDraftContext.tsx";
import { modelSummary } from "./decision-model-summary.ts";
import { starterModel } from "./starter-model.ts";
export function DecisionModelCard({
  path,
  dependencies = true,
}: {
  path: string;
  dependencies?: boolean;
}) {
  const context = useContext(ModelDraftContext);
  const query = useQuery({
    queryKey: ["decision-model", path, context?.base],
    queryFn: () => fetchDecisionModel(path, context!.base),
    enabled: !!context?.base,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (!context) return null;
  if (!context.base)
    return <p className="muted">Decision models open once the process repository is loaded.</p>;
  const result = query.data;
  if (!result) return <p role="status">Loading decision model…</p>;
  if (result.kind !== "ok")
    return (
      <p role="alert">
        Cannot read the model. Try again.{" "}
        <Button variant="outline" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </p>
    );
  const source = context.models[path] ?? {
    baseText: result.body.text,
    text: result.body.text,
    exists: result.body.exists,
  };
  let related: string[] = [];
  try {
    const model: unknown = parse(source.text);
    if (
      dependencies &&
      typeof model === "object" &&
      model !== null &&
      "nodes" in model &&
      Array.isArray(model.nodes)
    )
      related = [
        ...new Set(
          model.nodes.flatMap((node) =>
            node?.type === "decisionNode" && isDecisionModelPath(node.content?.key)
              ? [node.content.key as string]
              : [],
          ),
        ),
      ].filter((key) => key !== path);
  } catch {
    /* Syntax findings keep YAML editable. */
  }
  const summary = modelSummary(source.text);
  const malformed =
    !summary ||
    (!context.models[path] &&
      result.body.findings.some(
        (f) =>
          f.kind === "decision-model" &&
          typeof f["finding"] === "object" &&
          f["finding"] !== null &&
          Reflect.get(f["finding"], "kind") === "structure",
      ));
  const problems =
    context.problems?.filter((f) => f["file"] === path).length ??
    result.body.findings.length + result.body.warnings.length;
  return (
    <div className="decision-model-card">
      {!source.exists && !context.models[path] ? (
        <>
          <p className="warning-text">
            No decision model at <span className="mono">{path}</span>
          </p>
          <Button
            variant="outline"
            disabled={context.readOnly}
            onClick={() => context.apply(path, { ...source, text: starterModel() })}
          >
            Create decision model
          </Button>
        </>
      ) : (
        <>
          {malformed ? (
            <p className="error-text">
              Cannot read this model <small>{result.body.findings[0]?.message}</small>
            </p>
          ) : summary?.tables.length ? (
            <>
              {summary.tables.slice(0, 3).map((table) => (
                <p key={table.id}>
                  {summary.tables.length > 1 ? `${table.name} · ` : ""}
                  {table.rules} rules · {table.hitPolicy} ·{" "}
                  <span className="mono">{table.inputs.join(", ")}</span>
                </p>
              ))}
              {summary.tables.length > 3 ? <p>+{summary.tables.length - 3} more tables</p> : null}
            </>
          ) : (
            <p>{summary?.nodes} nodes · no decision table</p>
          )}
          {problems ? (
            <p className={result.body.findings.length ? "error-text" : "warning-text"}>
              {problems} problems
            </p>
          ) : null}
          <Button variant="outline" onClick={() => context.open(path, source)}>
            Open decision model
          </Button>
        </>
      )}
      {related.map((key) => (
        <section key={key}>
          <p className="mono">{key}</p>
          <DecisionModelCard path={key} dependencies={false} />
        </section>
      ))}
    </div>
  );
}
export function IntakeDecisionModel() {
  const context = useContext(ModelDraftContext);
  if (!context) return null;
  return (
    <section>
      <h4>Intake</h4>
      {!context.base ? (
        <p>Decision models open once the process repository is loaded.</p>
      ) : context.intake ? (
        <>
          <p>Tasks start from the intake decision model</p>
          <p className="mono">{context.intake}</p>
          <DecisionModelCard path={context.intake} />
        </>
      ) : (
        <p className="warning-text">manifold.yml names no intake decision model</p>
      )}
    </section>
  );
}
