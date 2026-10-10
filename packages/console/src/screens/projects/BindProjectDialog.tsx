// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { BindingsResponse } from "@wyrd-company/manifold-shared/declarations-api";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { useBindingSave } from "./useBindingSave.ts";
import { BindingChoices, ProjectChoices, BindingFindings, BindingNotice } from "./BindingForm.tsx";
import { parseProjectReference, bindingName } from "./binding-names.ts";
export function BindProjectDialog({
  bindings,
  onClose,
}: {
  bindings: BindingsResponse;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [named, setNamed] = useState(false);
  const [environment, setEnvironment] = useState(bindings.environments[0]?.name ?? "");
  const [item, setItem] = useState("");
  const [ids, setIds] = useState<string[]>([]);
  const [understood, setUnderstood] = useState(false);
  const parsed = parseProjectReference(reference);
  const save = useBindingSave(bindings, () => {
    onClose();
    void navigate({ to: "/projects/$binding", params: { binding: name } });
  });
  const finding = (member?: string) => (
    <BindingFindings findings={save.findings} name={name} {...(member ? { member } : {})} />
  );
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !save.busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 480 }} showCloseButton={!save.busy}>
        <DialogTitle>Bind a Project</DialogTitle>
        <DialogDescription>Bind a GitHub Project to a portfolio item.</DialogDescription>
        <BindingNotice error={save.error} saved={save.saved}>
          <fieldset disabled={save.busy} className="binding-form">
            <label>
              Project
              <input
                placeholder="owner/number or GitHub Project URL"
                value={reference}
                onChange={(e) => {
                  setReference(e.target.value);
                  const project = parseProjectReference(e.target.value);
                  if (!named) setName(project ? bindingName(project.owner, project.number) : "");
                }}
              />
            </label>
            {finding("owner")}
            {finding("number")}
            <label>
              Name
              <input
                value={name}
                onChange={(e) => {
                  setNamed(true);
                  setName(e.target.value);
                }}
              />
            </label>
            {finding()}
            <BindingChoices
              bindings={bindings}
              environment={environment}
              item={item}
              onEnvironment={(v) => {
                setEnvironment(v);
                setIds([]);
              }}
              onItem={setItem}
            />
            {finding("environment")}
            {finding("item")}
            <p>Associate existing T3code projects</p>
            <ProjectChoices
              bindings={bindings}
              environment={environment}
              checked={ids}
              onChecked={setIds}
            />
            {finding("t3codeProjects")}
            <p className="warning-text">
              Manifold takes control of the fields of this Project that the task fields declare, and
              of their options. Nothing changes on GitHub until you apply.
            </p>
            <label className="binding-check">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
              />
              I understand
            </label>
          </fieldset>
        </BindingNotice>
        <div className="blueprint-dialog-actions">
          <Button variant="outline" disabled={save.busy} onClick={onClose}>
            {save.saved ? "Close" : "Cancel"}
          </Button>
          {!save.saved ? (
            <Button
              disabled={save.busy || !understood || !parsed}
              onClick={() => {
                if (parsed)
                  void save.send(
                    {
                      kind: "github-project",
                      mode: "add",
                      name,
                      ...parsed,
                      environment,
                      item,
                      t3codeProjects: ids,
                    },
                    `Bind ${parsed.owner}/${parsed.number} as ${name}`,
                  );
              }}
            >
              {save.busy ? "Saving…" : save.error ? "Try again" : "Bind and review changes"}
            </Button>
          ) : null}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
