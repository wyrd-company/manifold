// ---
// relationships:
//   implements: operator-console
// ---
import { ConflictAlert } from "../portfolio/ConflictAlert.tsx";
import { Button } from "../../ui/button.tsx";
import type { useAccountSave } from "./useAccountSave.ts";
export function SaveFeedback({
  state,
  onClose,
}: {
  state: ReturnType<typeof useAccountSave>;
  onClose: () => void;
}) {
  return (
    <>
      {state.candidate?.ok === false && state.candidate.reason === "name-missing" ? (
        <div role="alert" className="error-alert">
          {state.name} is no longer in accounts.yml.
        </div>
      ) : state.candidate?.ok === false && state.candidate.reason === "unparsable" ? (
        <div role="alert" className="error-alert">
          accounts.yml cannot be edited here. Fix it in the process repository.
        </div>
      ) : null}
      {state.lintError ? (
        <div role="alert" className="error-alert">
          Cannot check these changes. {state.lintError}
          <Button onClick={state.retryLint}>Try again</Button>
        </div>
      ) : !state.checked && state.text !== undefined ? (
        <p role="status">Checking…</p>
      ) : null}
      {state.error ? (
        <div role="alert" className="error-alert">
          {state.error}
          <Button disabled={state.busy} onClick={() => void state.save()}>
            Try again
          </Button>
        </div>
      ) : null}
      {state.saved ? (
        <div role="alert" className="info-alert">
          Saved as {state.saved.slice(0, 7)}. The service has not loaded it yet. Your changes are
          kept.
          <Button disabled={state.busy} onClick={() => void state.save()}>
            Load saved version
          </Button>
        </div>
      ) : null}
      {state.conflict ? (
        <ConflictAlert
          path="accounts.yml"
          conflict={state.conflict}
          busy={state.busy}
          onRebase={state.rebase}
          onDiscard={onClose}
        />
      ) : null}
    </>
  );
}
