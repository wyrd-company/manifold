// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import type {
  BindingsResponse,
  GitHubProjectBinding,
} from "@wyrd-company/manifold-shared/declarations-api";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { useBindingSave } from "./useBindingSave.ts";
import { ProjectChoices, BindingNotice } from "./BindingForm.tsx";
export function AssociateDialog({
  bindings,
  binding,
  onClose,
}: {
  bindings: BindingsResponse;
  binding: GitHubProjectBinding;
  onClose: () => void;
}) {
  const [ids, setIds] = useState([...binding.t3codeProjects]);
  const save = useBindingSave(bindings, onClose);
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !save.busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 440 }} showCloseButton={!save.busy}>
        <DialogTitle>Associate existing T3code projects</DialogTitle>
        <DialogDescription>
          On {binding.owner}/{binding.number}
        </DialogDescription>
        <BindingNotice error={save.error} saved={save.saved}>
          <fieldset disabled={save.busy}>
            <ProjectChoices
              bindings={bindings}
              environment={binding.environment}
              binding={binding.name}
              checked={ids}
              onChecked={setIds}
            />
            {save.findings.map((f) => (
              <p role="alert" className="error-text" key={f.location}>
                {f.message}
              </p>
            ))}
          </fieldset>
        </BindingNotice>
        <div className="blueprint-dialog-actions">
          <Button variant="outline" disabled={save.busy} onClick={onClose}>
            {save.saved ? "Close" : "Cancel"}
          </Button>
          {!save.saved ? (
            <Button
              disabled={save.busy}
              onClick={() =>
                void save.send(
                  {
                    kind: "github-project",
                    mode: "replace",
                    name: binding.name,
                    owner: binding.owner,
                    number: binding.number,
                    environment: binding.environment,
                    item: binding.item,
                    t3codeProjects: ids,
                  },
                  `Associate T3code projects with ${binding.name}`,
                )
              }
            >
              {save.busy ? "Saving…" : save.error ? "Try again" : "Save"}
            </Button>
          ) : null}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
