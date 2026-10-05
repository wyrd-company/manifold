// ---
// relationships:
//   implements: operator-console
// ---
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
export function PublishDialog({
  open,
  path,
  added,
  repository,
  message,
  onMessage,
  busy,
  error,
  onClose,
  onPublish,
}: {
  open: boolean;
  path: string;
  added: boolean;
  repository: { url: string; branch: string };
  message: string;
  onMessage: (value: string) => void;
  busy: boolean;
  error?: string | undefined;
  onClose: () => void;
  onPublish: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 480 }} showCloseButton={!busy}>
        <DialogTitle>Publish blueprint</DialogTitle>
        <DialogDescription>Commit and push this file to the process repository.</DialogDescription>
        <p className="mono">
          {added ? "A" : "M"} {path}
        </p>
        {added ? <p className="muted">This file replaces the bundled blueprint.</p> : null}
        <label className="blueprint-message">
          Commit message
          <input
            value={message}
            onChange={(event) => onMessage(event.target.value)}
            disabled={busy}
          />
        </label>
        <p className="mono muted">
          {repository.url} · {repository.branch}
        </p>
        {error ? (
          <p role="alert" className="error-alert">
            {error}
          </p>
        ) : null}
        <div className="blueprint-dialog-actions">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !message.trim()} onClick={onPublish}>
            {busy ? "Saving…" : error ? "Try again" : "Commit and push"}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}
