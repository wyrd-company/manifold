// ---
// relationships:
//   implements: operator-console
// ---
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { ProblemsList } from "../portfolio/ProblemsList.tsx";
import { useAccountSave } from "./useAccountSave.ts";
import { SaveFeedback } from "./SaveFeedback.tsx";
export function ArchiveDialog({
  name,
  source,
  onClose,
  onSaved,
}: {
  name: string;
  source: { commit: string; text: string };
  onClose: () => void;
  onSaved: (toast: string) => void;
}) {
  const state = useAccountSave(
    source,
    { kind: "archive", name },
    `Archive account ${name}`,
    onSaved,
    true,
  );
  const warnings =
    state.lint?.warnings.filter(
      (f) => f.kind === "account-archived" && f.message.includes(`"${name}"`),
    ) ?? [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !state.busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 400 }} showCloseButton={!state.busy}>
        <DialogTitle>Archive {name}?</DialogTitle>
        <DialogDescription>
          Calls from its environments stop charging it, and it gets no new budget. Its past usage
          stays under its name.
        </DialogDescription>
        {warnings.length ? (
          <>
            <p>These portfolio items allocate to it and will reserve nothing from it:</p>
            <ul>
              {warnings.map((warning) => (
                <li key={warning.location}>
                  {String(
                    (warning["details"] as { item?: string } | undefined)?.item ?? warning.location,
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <ProblemsList lint={state.lint} />
        <SaveFeedback state={state} onClose={onClose} />
        <div className="blueprint-dialog-actions">
          <Button variant="outline" disabled={state.busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="portfolio-confirm-archive"
            disabled={!state.ready}
            onClick={() => void state.save()}
          >
            Archive account
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
