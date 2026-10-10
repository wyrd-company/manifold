// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useState, useEffectEvent } from "react";
import { EditorState } from "@codemirror/state";
import { MergeView } from "@codemirror/merge";
import { yaml } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
export function CompareDialog({
  open,
  latest,
  text,
  onChange,
  onClose,
  files,
  selected,
  onSelect,
}: {
  files?: readonly string[];
  selected?: string | undefined;
  onSelect?: ((path: string) => void) | undefined;
  open: boolean;
  latest: string;
  text: string;
  onChange: (value: string) => void;
  onClose: () => void;
}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const change = useEffectEvent(onChange);
  const currentText = useEffectEvent(() => text);
  useEffect(() => {
    if (!open || !container) return;
    const view = new MergeView({
      parent: container,
      a: { doc: latest, extensions: [yaml(), EditorState.readOnly.of(true)] },
      b: {
        doc: currentText(),
        extensions: [
          yaml(),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) change(update.state.doc.toString());
          }),
        ],
      },
      revertControls: "a-to-b",
    });
    view.dom.dataset["file"] = selected ?? "";
    return () => view.destroy();
  }, [open, latest, container, selected]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPopup style={{ width: 920, maxWidth: "calc(100vw - 32px)" }}>
        <DialogTitle>{files?.length ? "Compare files" : "Compare blueprint"}</DialogTitle>
        {files?.length ? (
          <label>
            File
            <select
              aria-label="Compare file"
              value={selected}
              onChange={(e) => onSelect?.(e.target.value)}
            >
              {files.map((path) => (
                <option key={path}>{path}</option>
              ))}
            </select>
          </label>
        ) : null}
        <DialogDescription>Branch text on the left. Your draft on the right.</DialogDescription>
        <div className="blueprint-compare" ref={setContainer} />
      </DialogPopup>
    </Dialog>
  );
}
