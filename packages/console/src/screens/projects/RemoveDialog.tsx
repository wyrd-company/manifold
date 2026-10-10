// ---
// relationships:
//   implements: operator-console
// ---
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import type { ProjectChange } from "../../api/projects.ts";
import { changeTarget } from "./plan.ts";
export function RemoveDialog({
  open,
  changes,
  onClose,
  onApply,
}: {
  open: boolean;
  changes: readonly ProjectChange[];
  onClose: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogPopup style={{ width: 400 }}>
        <DialogTitle>Remove from GitHub?</DialogTitle>
        <DialogDescription>
          This Apply also removes {changes.length} things the task fields do not define:{" "}
          {changes.slice(0, 5).map(changeTarget).join(", ")}
          {changes.length > 5 ? `, and ${changes.length - 5} more` : ""}. Manifold does not restore
          them.
        </DialogDescription>
        <div className="blueprint-dialog-actions">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onApply}>
            Apply and remove
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
