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
}: {
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
    return () => view.destroy();
  }, [open, latest, container]);
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPopup style={{ width: 920, maxWidth: "calc(100vw - 32px)" }}>
        <DialogTitle>Compare blueprint</DialogTitle>
        <DialogDescription>Branch text on the left. Your draft on the right.</DialogDescription>
        <div className="blueprint-compare" ref={setContainer} />
      </DialogPopup>
    </Dialog>
  );
}
