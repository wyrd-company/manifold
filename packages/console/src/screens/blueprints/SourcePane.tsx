// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useRef, useEffectEvent } from "react";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLineGutter, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { setDiagnostics, lintGutter } from "@codemirror/lint";
import { unifiedMergeView } from "@codemirror/merge";
import type { ApiFinding } from "@wyrd-company/manifold-shared/blueprints-api";
import { Button } from "../../ui/button.tsx";
export function SourcePane({
  path,
  text,
  baseText,
  findings,
  warnings,
  readOnly,
  onChange,
  cursor,
  onCursor,
}: {
  path: string;
  text: string;
  baseText: string;
  findings: readonly ApiFinding[];
  warnings: readonly ApiFinding[];
  readOnly: boolean;
  onChange: (text: string) => void;
  cursor?: number | undefined;
  onCursor: (position: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changed = useEffectEvent(onChange);
  const moved = useEffectEvent(onCursor);
  const compartment = useRef(new Compartment());
  const createEditor = useEffectEvent(
    () =>
      new EditorView({
        parent: container.current!,
        state: EditorState.create({
          doc: text,
          extensions: [
            lineNumbers(),
            highlightActiveLineGutter(),
            history(),
            keymap.of([...defaultKeymap, ...historyKeymap]),
            yaml(),
            lintGutter(),
            compartment.current.of([
              EditorState.readOnly.of(readOnly),
              EditorView.editable.of(!readOnly),
            ]),
            unifiedMergeView({ original: baseText, mergeControls: false, allowInlineDiffs: false }),
            EditorView.theme({
              "&": { height: "100%", color: "var(--foreground)", backgroundColor: "var(--card)" },
              ".cm-scroller": {
                overflow: "auto",
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
              },
              ".cm-gutters": {
                backgroundColor: "var(--sidebar)",
                color: "var(--muted-foreground)",
                borderColor: "var(--border)",
              },
              ".cm-content": { caretColor: "var(--foreground)" },
            }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) changed(update.state.doc.toString());
              if (update.selectionSet) moved(update.state.selection.main.head);
            }),
          ],
        }),
      }),
  );
  useEffect(() => {
    const editor = createEditor();
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // Recreate only when the document identity or comparison base changes.
    // eslint-disable-next-line react/exhaustive-effect-dependencies -- A new comparison base recreates the external editor.
  }, [path, baseText]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== text)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: text } });
  }, [text]);
  useEffect(() => {
    view.current?.dispatch({
      effects: compartment.current.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    editor.dispatch(
      setDiagnostics(
        editor.state,
        [
          ...findings.map((finding) => ({ ...finding, severity: "error" as const })),
          ...warnings.map((finding) => ({ ...finding, severity: "warning" as const })),
        ].flatMap((finding) =>
          finding.range
            ? [
                {
                  from: Math.min(finding.range.from, editor.state.doc.length),
                  to: Math.min(finding.range.to, editor.state.doc.length),
                  severity: finding.severity,
                  message: finding.message,
                },
              ]
            : [],
        ),
      ),
    );
    // eslint-disable-next-line react/exhaustive-effect-dependencies -- Reapply diagnostics after recreating the external editor.
  }, [findings, warnings, baseText]);
  useEffect(() => {
    const editor = view.current;
    if (editor && cursor !== undefined) {
      editor.dispatch({
        selection: { anchor: Math.min(cursor, editor.state.doc.length) },
        scrollIntoView: true,
      });
      editor.focus();
    }
  }, [cursor]);
  return (
    <section className="blueprint-source">
      <div className="blueprint-pane-toolbar">
        <span className="mono">{path}</span>
        <span className="muted">▏ Changed lines</span>
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(text);
          }}
        >
          Copy
        </Button>
      </div>
      <div className="blueprint-code" ref={container} />
    </section>
  );
}
