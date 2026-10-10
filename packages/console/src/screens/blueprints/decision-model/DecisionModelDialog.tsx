// ---
// relationships:
//   implements: [operator-console, decision-models]
// ---
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { parse, stringify } from "yaml";
import { DecisionGraph, JdmConfigProvider } from "@gorules/jdm-editor";
import type { ReactFlowInstance } from "reactflow";
import type { DecisionGraphRef, DecisionNode } from "@gorules/jdm-editor";
import type { ModelFinding, ModelFindings } from "@wyrd-company/manifold-shared/declarations-api";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../../ui/dialog.tsx";
import { Button } from "../../../ui/button.tsx";
import { isDrawableDecisionModel } from "@wyrd-company/manifold-shared/declarations-api";
import { SourcePane } from "../SourcePane.tsx";
import { lintDecisionModelText, evaluateDecisionModel } from "../../../api/declarations.ts";
import type { ModelDraft } from "./model-drafts.ts";
import { prepareModel, writeModel } from "./decision-model-text.ts";
import { modelProblem } from "./model-problems.ts";
import { customNodes, components } from "./jdm-nodes.tsx";
import { useJdmTheme } from "./jdm-theme.ts";
import "@gorules/jdm-editor/dist/style.css";
import "./decision-model-dialog.css";
export default function DecisionModelDialog({
  path,
  source,
  base,
  models,
  readOnly,
  initialCursor,
  onClose,
  onApply,
}: {
  path: string;
  source: ModelDraft;
  base: string;
  models: Readonly<Record<string, ModelDraft>>;
  readOnly: boolean;
  initialCursor?: number | undefined;
  onClose(): void;
  onApply(text: string): void;
}) {
  const [text, setText] = useState(source.text),
    [requestedView, setView] = useState<"visual" | "yaml">(() => {
      try {
        return isDrawableDecisionModel(parse(source.text)) ? "visual" : "yaml";
      } catch {
        return "yaml";
      }
    }),
    [discard, setDiscard] = useState(false),
    [cursor, setCursor] = useState(initialCursor);
  const [lint, setLint] = useState<{ text: string; body: ModelFindings }>(),
    [checking, setChecking] = useState(false),
    [failure, setFailure] = useState<string>(),
    [retry, setRetry] = useState(0);
  const [input, setInput] = useState("{}"),
    [result, setResult] = useState<string>(),
    [evaluating, setEvaluating] = useState(false),
    [add, setAdd] = useState(false);
  const [evaluationProblem, setEvaluationProblem] = useState<{
    text: string;
    finding: ModelFinding;
  }>();
  const graph = useRef<DecisionGraphRef>(null);
  const flow = useRef<ReactFlowInstance>(null),
    viewElement = useRef<HTMLDivElement>(null);
  const theme = useJdmTheme();
  const overlay = useMemo(
    () =>
      Object.entries(models)
        .filter(([name]) => name !== path)
        .map(([path, model]) => ({ path, text: model.text })),
    [models, path],
  );
  const prepared = useMemo(() => {
    try {
      const model: unknown = parse(text);
      return isDrawableDecisionModel(model) ? prepareModel(model) : undefined;
    } catch {
      return undefined;
    }
  }, [text]);
  const initialTable = useRef(
    prepared?.model.nodes
      .filter((n) => (n.content as { kind?: string })?.kind === "jsonataDecisionTable")
      .map((n) => n.id),
  );
  const openedInitial = useRef(false);
  const unsubscribeGraph = useRef<(() => void) | undefined>(undefined);
  const attachGraph = useCallback((ref: DecisionGraphRef | null) => {
    unsubscribeGraph.current?.();
    unsubscribeGraph.current = undefined;
    graph.current = ref;
    if (ref)
      unsubscribeGraph.current = ref.stateStore.subscribe((state) => {
        const editable = new Set(
          state.decisionGraph.nodes
            .filter(
              (node) =>
                ["inputNode", "outputNode", "decisionNode"].includes(node.type ?? "") ||
                (node.type === "customNode" &&
                  ["jsonataDecisionTable", "jsonataExpression", "jsonataSwitch"].includes(
                    (node.content as { kind: string }).kind,
                  )),
            )
            .map((node) => node.id),
        );
        const openTabs = state.openTabs.filter((id) => editable.has(id));
        if (openTabs.length !== state.openTabs.length)
          ref.stateStore.setState({
            openTabs,
            activeTab:
              state.activeTab === "graph" || editable.has(state.activeTab ?? "graph")
                ? state.activeTab
                : "graph",
          });
      });
    if (ref && !openedInitial.current && initialTable.current?.length === 1) {
      openedInitial.current = true;
      queueMicrotask(() => ref.openTab(initialTable.current![0]!));
    }
  }, []);
  const cannotDraw =
    !prepared ||
    !!(
      lint?.text === text &&
      lint.body.findings.some(
        (f) =>
          f.file === path &&
          f.kind === "decision-model" &&
          typeof f["finding"] === "object" &&
          f["finding"] !== null &&
          Reflect.get(f["finding"], "kind") === "structure",
      )
    );
  const view = cannotDraw ? "yaml" : requestedView;
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setChecking(true);
      void lintDecisionModelText({ path, text, base, models: overlay }, controller.signal).then(
        (answer) => {
          if (controller.signal.aborted) return;
          setChecking(false);
          if (answer.kind === "ok") {
            setLint({ text, body: answer.body });
            setFailure(undefined);
          } else setFailure(answer.kind === "failed" ? answer.message : "Cannot lint model.");
        },
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort(`Model lint attempt ${retry} replaced`);
    };
  }, [text, path, base, overlay, retry]);
  const problems = useMemo(
    () => [
      ...(lint?.text === text ? [...lint.body.findings, ...lint.body.warnings] : []),
      ...(evaluationProblem?.text === text ? [evaluationProblem.finding] : []),
    ],
    [lint, text, evaluationProblem],
  );
  useEffect(() => {
    const root = viewElement.current;
    if (!root || view !== "visual") return;
    const decorate = () => {
      const marked = new Map<HTMLElement, string>();
      for (const finding of problems) {
        if (finding.file !== path) continue;
        const target = modelProblem(finding, prepared?.model);
        const severity = finding["severity"] === "warning" ? "warning" : "error";
        const field = target.label
          ? root.querySelector<HTMLElement>(
              `[role="textbox"][aria-label="${CSS.escape(target.label)}"]`,
            )
          : null;
        if (field) {
          marked.set(field, severity);
        } else if (target.column) {
          for (const header of root.querySelectorAll<HTMLElement>("th"))
            if (header.textContent?.includes(target.column)) marked.set(header, severity);
        } else if (target.nodeId) {
          const node = root.querySelector<HTMLElement>(
            `[data-id="${CSS.escape(target.nodeId)}"] .grl-graph-node`,
          );
          if (node) marked.set(node, severity);
        }
      }
      for (const element of root.querySelectorAll<HTMLElement>("[data-model-problem]"))
        if (!marked.has(element)) {
          element.removeAttribute("data-model-problem");
          element.removeAttribute("aria-invalid");
        }
      for (const [element, severity] of marked) {
        if (element.dataset["modelProblem"] !== severity)
          element.dataset["modelProblem"] = severity;
        const invalid = severity === "error" ? "true" : "false";
        if (
          element.getAttribute("role") === "textbox" &&
          element.getAttribute("aria-invalid") !== invalid
        )
          element.setAttribute("aria-invalid", invalid);
      }
    };
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [problems, prepared, path, view]);
  const changed = text !== source.text;
  const workingText = () => {
    const current = graph.current?.stateStore.getState().decisionGraph;
    if (view !== "visual" || !current || !prepared) return text;
    const model = current;
    return writeModel(text, prepared.authored(model));
  };
  const close = () => (workingText() !== source.text && !readOnly ? setDiscard(true) : onClose());
  const focus = (finding: ModelFinding) => {
    if (finding.file !== path) {
      setFailure(`${finding.file}: ${finding.message}`);
      return;
    }
    const detail = finding["finding"];
    const node =
      typeof detail === "object" &&
      detail !== null &&
      "nodeId" in detail &&
      typeof detail.nodeId === "string"
        ? detail.nodeId
        : undefined;
    if (node && view === "visual") {
      graph.current?.openTab(node);
      queueMicrotask(() => {
        const label = modelProblem(finding, prepared?.model).label;
        if (label)
          viewElement.current
            ?.querySelector<HTMLElement>(`[role="textbox"][aria-label="${CSS.escape(label)}"]`)
            ?.focus();
      });
    } else {
      setView("yaml");
      setCursor(finding.range?.from);
    }
  };
  const evaluate = async () => {
    let value: unknown;
    try {
      value = parse(input);
      if (typeof value !== "object" || value === null || Array.isArray(value))
        throw new Error("Input must be a YAML object.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
      return;
    }
    setEvaluationProblem(undefined);
    setEvaluating(true);
    const working = workingText();
    setText(working);
    const answer = await evaluateDecisionModel({
      path,
      text: working,
      base,
      models: overlay,
      input: value as Record<string, unknown>,
    });
    setEvaluating(false);
    if (answer.kind === "ok") {
      setResult(stringify(answer.body));
      if (answer.body.evaluation.outcome === "error") {
        const finding = {
          file: path,
          kind: "evaluation",
          location: "",
          message: answer.body.evaluation.error.message,
          finding: answer.body.evaluation.error,
        };
        setEvaluationProblem({ text: working, finding });
        focus(finding);
      }
    } else
      setResult(
        answer.kind === "invalid"
          ? "Fix the problems to evaluate."
          : answer.kind === "failed"
            ? answer.message
            : "Cannot evaluate model.",
      );
  };
  const addNode = (kind: string) => {
    if (!graph.current) return;
    const id = crypto.randomUUID();
    const bounds = viewElement.current!.querySelector(".react-flow")!.getBoundingClientRect();
    const position = flow.current!.screenToFlowPosition({
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    });
    let node: DecisionNode;
    if (kind.startsWith("jsonata")) {
      const config =
        kind === "jsonataDecisionTable"
          ? { hitPolicy: "first", inputs: [], outputs: [], rules: [] }
          : kind === "jsonataExpression"
            ? { expression: "$" }
            : {
                hitPolicy: "first",
                statements: [{ id: crypto.randomUUID(), condition: "" }],
              };
      node = {
        id,
        name: customNodes.find((n) => n.kind === kind)!.displayName,
        type: "customNode",
        position,
        content: { kind, config },
      };
    } else
      node = {
        id,
        name: kind === "inputNode" ? "Input" : kind === "outputNode" ? "Output" : "Decision model",
        type: kind,
        position,
        content: kind === "decisionNode" ? { key: "" } : {},
      };
    graph.current.addNodes([node]);
    graph.current.triggerNodeSelect(id, "only");
    setAdd(false);
  };
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogPopup
          className="decision-model-dialog"
          style={{ width: 920, maxWidth: "calc(100vw - 32px)" }}
        >
          <DialogTitle>Decision model</DialogTitle>
          <DialogDescription className="mono">{path}</DialogDescription>
          <div className="model-toolbar">
            {changed ? (
              <span className="warning-text">
                {text.split("\n").filter((line, i) => line !== source.text.split("\n")[i]).length}{" "}
                changes
              </span>
            ) : null}
            <Button
              variant="ghost"
              aria-pressed={view === "visual"}
              disabled={cannotDraw}
              onClick={() => setView("visual")}
            >
              Visual
            </Button>
            <Button
              variant="ghost"
              aria-pressed={view === "yaml"}
              onClick={() => {
                setText(workingText());
                setView("yaml");
              }}
            >
              YAML
            </Button>
            {view === "visual" ? (
              <div>
                <Button variant="outline" disabled={readOnly} onClick={() => setAdd(!add)}>
                  Add node
                </Button>
                {add ? (
                  <div role="menu">
                    {[
                      ["jsonataDecisionTable", "JSONata decision table"],
                      ["jsonataExpression", "JSONata expression"],
                      ["jsonataSwitch", "JSONata switch"],
                      ["decisionNode", "Decision model"],
                      ["inputNode", "Input"],
                      ["outputNode", "Output"],
                    ].map(([kind, name]) => (
                      <Button
                        key={kind}
                        role="menuitem"
                        variant="ghost"
                        disabled={
                          kind === "inputNode" &&
                          prepared?.model.nodes.some((n) => n.type === "inputNode")
                        }
                        onClick={() => addNode(kind!)}
                      >
                        {name}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {cannotDraw ? (
            <p role="alert">The editor cannot draw this model. Fix it in the YAML view.</p>
          ) : null}
          <div className="model-view" ref={viewElement}>
            {view === "yaml" ? (
              <SourcePane
                path={path}
                text={text}
                baseText={source.text}
                findings={lint?.body.findings.filter((f) => f.file === path) ?? []}
                warnings={lint?.body.warnings.filter((f) => f.file === path) ?? []}
                readOnly={readOnly}
                onChange={setText}
                cursor={cursor}
                onCursor={() => {}}
              />
            ) : prepared ? (
              <JdmConfigProvider prefixCls="mf-jdm" theme={theme}>
                <DecisionGraph
                  ref={attachGraph}
                  onReactFlowInit={(instance) => {
                    flow.current = instance;
                  }}
                  value={prepared.model}
                  disabled={readOnly}
                  customNodes={customNodes}
                  components={components}
                  hideLeftToolbar
                  onChange={(model) => setText(writeModel(text, prepared.authored(model)))}
                />
              </JdmConfigProvider>
            ) : null}
          </div>
          <div className="model-problems">
            <strong>
              Problems {(lint?.body.findings.length ?? 0) + (lint?.body.warnings.length ?? 0)}
            </strong>
            {checking || lint?.text !== text ? <span role="status"> Checking…</span> : null}
            {failure ? (
              <p role="alert">
                {failure}
                <Button variant="outline" onClick={() => setRetry((n) => n + 1)}>
                  Try again
                </Button>
              </p>
            ) : null}
            {[...(lint?.body.findings ?? []), ...(lint?.body.warnings ?? [])].map((f) => (
              <button
                type="button"
                key={`${f.file}:${f.location}:${f.message}`}
                onClick={() => focus(f)}
              >
                {f.file !== path ? `${f.file}: ` : ""}
                {modelProblem(f, prepared?.model).description}
              </button>
            ))}
          </div>
          <details>
            <summary>Evaluate</summary>
            <label>
              Input YAML
              <textarea
                aria-label="Evaluation input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
            </label>
            <Button
              variant="outline"
              disabled={
                evaluating || checking || lint?.text !== text || !!lint.body.findings.length
              }
              onClick={() => {
                void evaluate();
              }}
            >
              Evaluate
            </Button>
            {result ? <pre aria-label="Evaluation result">{result}</pre> : null}
          </details>
          <div className="blueprint-dialog-actions">
            {readOnly ? (
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button disabled={!changed} onClick={() => onApply(workingText())}>
                  Apply to draft
                </Button>
              </>
            )}
          </div>
        </DialogPopup>
      </Dialog>
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogPopup style={{ width: 400 }}>
          <DialogTitle>Discard changes to {path}?</DialogTitle>
          <DialogDescription>Your working changes will be discarded.</DialogDescription>
          <div className="blueprint-dialog-actions">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Keep editing
            </Button>
            <Button style={{ background: "var(--error)" }} onClick={onClose}>
              Discard changes
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
    </>
  );
}
