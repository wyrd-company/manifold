// ---
// relationships:
//   implements: operator-console
// ---
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
export function DiscardDialog({
  open,
  changes,
  commit,
  onClose,
  onDiscard,
}: {
  open: boolean;
  changes: number;
  commit: string;
  onClose: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPopup style={{ width: 400 }}>
        <DialogTitle>Discard draft?</DialogTitle>
        <DialogDescription>
          {changes} changed lines will be discarded. Version {commit.slice(0, 7)} stays.
        </DialogDescription>
        <div className="blueprint-dialog-actions">
          <Button variant="outline" onClick={onClose}>
            Keep draft
          </Button>
          <Button variant="outline" onClick={onDiscard}>
            Discard draft
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
