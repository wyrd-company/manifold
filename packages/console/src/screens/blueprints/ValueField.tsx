// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { EditorState, Compartment, Annotation } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { yaml } from "@codemirror/lang-yaml";
import { setDiagnostics } from "@codemirror/lint";
import { parseDocument, stringify } from "yaml";
import type { ApiFinding } from "@wyrd-company/manifold-shared/blueprints-api";
const externalChange = Annotation.define<boolean>();
export type InspectorProblem = ApiFinding & { severity?: "error" | "warning" };
const noFindings: readonly InspectorProblem[] = [];
export function ValueField({
  label,
  value,
  expression = false,
  disabled,
  findings = noFindings,
  onChange,
}: {
  label: string;
  value: unknown;
  expression?: boolean;
  disabled: boolean;
  findings?: readonly InspectorProblem[];
  onChange: (value: unknown) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const [error, setError] = useState<string>();
  const compartment = useRef(new Compartment());
  const text = expression
    ? String(value ?? "")
    : value === undefined
      ? ""
      : stringify(value).trimEnd();
  const changed = useEffectEvent((next: string) => {
    if (expression) {
      onChange(next);
      return;
    }
    const doc = parseDocument(next);
    if (doc.errors.length) {
      setError(doc.errors[0]?.message);
      return;
    }
    setError(undefined);
    onChange(doc.toJS());
  });
  const create = useEffectEvent(
    () =>
      new EditorView({
        parent: host.current!,
        state: EditorState.create({
          doc: text,
          extensions: [
            expression ? [] : yaml(),
            compartment.current.of([
              EditorState.readOnly.of(disabled),
              EditorView.editable.of(!disabled),
            ]),
            EditorView.contentAttributes.of({ "aria-label": label }),
            EditorView.theme({
              "&": { color: "var(--foreground)", background: "var(--card)" },
              ".cm-scroller": {
                maxHeight: "160px",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
              },
              ".cm-content": { minHeight: "28px" },
            }),
            EditorView.updateListener.of((update) => {
              if (
                update.docChanged &&
                !update.transactions.every((t) => t.annotation(externalChange))
              )
                changed(update.state.doc.toString());
            }),
          ],
        }),
      }),
  );
  useEffect(() => {
    const editor = create();
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, []);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== text && !editor.hasFocus)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: text },
        annotations: externalChange.of(true),
      });
  }, [text]);
  useEffect(() => {
    view.current?.dispatch({
      effects: compartment.current.reconfigure([
        EditorState.readOnly.of(disabled),
        EditorView.editable.of(!disabled),
      ]),
    });
  }, [disabled]);
  useEffect(() => {
    const editor = view.current;
    if (editor)
      editor.dispatch(
        setDiagnostics(
          editor.state,
          findings.map((f) => ({
            from:
              "position" in f && typeof f["position"] === "number"
                ? Math.min(f["position"], editor.state.doc.length)
                : 0,
            to: editor.state.doc.length,
            severity: f.severity ?? "error",
            message: f.message,
          })),
        ),
      );
  }, [findings]);
  return (
    <div
      className={`inspector-value ${findings.length ? (findings.every((f) => f.severity === "warning") ? "has-finding warning" : "has-finding") : ""}`}
    >
      <span>
        {label}
        {expression ? <small className="mono muted"> JSONata</small> : null}
      </span>
      <div ref={host} />
      {error ? <small role="alert">{error}</small> : null}
      {findings.map((f) => (
        <small
          className={f.severity === "warning" ? "warning-text" : "error-text"}
          key={f.location + ":" + f.message}
        >
          {f.message}
        </small>
      ))}
    </div>
  );
}
