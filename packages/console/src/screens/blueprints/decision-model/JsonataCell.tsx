// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useEffectEvent, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, placeholder } from "@codemirror/view";
export function JsonataCell({
  value,
  onChange,
  label,
  disabled = false,
  lines = 1,
  rule = false,
  output = false,
}: {
  value: string;
  onChange(value: string, ruleIndex?: number): void;
  label: string;
  disabled?: boolean;
  lines?: number;
  rule?: boolean;
  output?: boolean;
}) {
  const parent = useRef<HTMLDivElement>(null),
    view = useRef<EditorView>(null);
  const changed = useEffectEvent(onChange);
  useEffect(() => {
    const editor = new EditorView({
      parent: parent.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          placeholder("JSONata"),
          EditorView.contentAttributes.of({ "aria-label": label }),
          EditorState.readOnly.of(disabled),
          EditorView.editable.of(!disabled),
          EditorView.theme({
            "&": {
              background: "var(--card)",
              color: "var(--foreground)",
              minHeight: `${lines * 22}px`,
            },
            ".cm-scroller": {
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
            },
            ".cm-content": { padding: "3px 6px" },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged)
              changed(
                u.state.doc.toString(),
                rule
                  ? Number(
                      parent.current
                        ?.closest("[data-virtual-index]")
                        ?.getAttribute("data-virtual-index"),
                    )
                  : undefined,
              );
          }),
        ],
      }),
    });
    view.current = editor;
    // This editor version omits TableCellProps.index at runtime; the virtual row
    // retains its index when it moves or the table scrolls.
    const row = rule ? parent.current?.closest("[data-virtual-index]") : null;
    const name = () => {
      if (row)
        editor.contentDOM.setAttribute(
          "aria-label",
          `${label} rule ${Number(row.getAttribute("data-virtual-index")) + 1}`,
        );
    };
    name();
    const observer = new MutationObserver(name);
    if (row)
      observer.observe(row, {
        attributes: true,
        attributeFilter: ["data-virtual-index"],
      });
    return () => {
      observer.disconnect();
      editor.destroy();
      view.current = null;
    };
    // The external editor is recreated when its editing contract changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The external editor reads text when mounted; later changes are dispatched below.
  }, [label, disabled, lines, rule]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value)
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
      });
  }, [value]);
  return (
    <div className={`model-jsonata nodrag nowheel${output ? " model-output" : ""}`} ref={parent} />
  );
}
