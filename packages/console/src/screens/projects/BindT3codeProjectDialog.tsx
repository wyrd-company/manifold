// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import type { BindingsResponse } from "@wyrd-company/manifold-shared/declarations-api";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { useBindingSave } from "./useBindingSave.ts";
import { BindingChoices, BindingFindings, BindingNotice } from "./BindingForm.tsx";
import { bindingName } from "./binding-names.ts";
export function BindT3codeProjectDialog({
  bindings,
  name: binding,
  onClose,
}: {
  bindings: BindingsResponse;
  name: string;
  onClose: () => void;
}) {
  const original = bindings.t3codeProjects.find((b) => b.name === binding);
  const [environment, setEnvironment] = useState(
    original?.environment ?? bindings.environments[0]?.name ?? "",
  );
  const [project, setProject] = useState(original?.project ?? "");
  const [name, setName] = useState(binding);
  const [named, setNamed] = useState(!!original);
  const [item, setItem] = useState(original?.item ?? "");
  const save = useBindingSave(bindings, onClose);
  const projects = bindings.environments.find((e) => e.name === environment)?.projects;
  const held = new Set([
    ...bindings.githubProjects
      .filter((b) => !b.archived && b.environment === environment)
      .flatMap((b) => b.t3codeProjects),
    ...bindings.t3codeProjects
      .filter((b) => !b.archived && b.name !== binding && b.environment === environment)
      .map((b) => b.project),
  ]);
  const choices = projects?.filter((p) => !held.has(p.id));
  return (
    <Dialog
      open
      onOpenChange={(v) => {
        if (!v && !save.busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 440 }} showCloseButton={!save.busy}>
        <DialogTitle>{original ? "Edit" : "Bind"} a T3code project</DialogTitle>
        <DialogDescription>Choose an existing project.</DialogDescription>
        <BindingNotice error={save.error} saved={save.saved}>
          <fieldset className="binding-form" disabled={save.busy}>
            <BindingChoices
              bindings={bindings}
              environment={environment}
              item={item}
              onEnvironment={(v) => {
                setEnvironment(v);
                setProject("");
              }}
              onItem={setItem}
            />
            <label>
              T3code project
              <select
                disabled={!projects}
                value={project}
                onChange={(e) => {
                  setProject(e.target.value);
                  if (!named)
                    setName(
                      bindingName(
                        choices?.find((p) => p.id === e.target.value)?.title ?? e.target.value,
                      ),
                    );
                }}
              >
                <option value="">Choose a project</option>
                {choices?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {p.workspaceRoot}
                  </option>
                ))}
                {original && !choices?.some((p) => p.id === original.project) ? (
                  <option value={original.project}>{original.project}</option>
                ) : null}
              </select>
            </label>
            {!projects ? (
              <p className="muted">Manifold has not read the projects of {environment} yet.</p>
            ) : null}
            <label>
              Name
              <input
                readOnly={!!original}
                value={name}
                onChange={(e) => {
                  setNamed(true);
                  setName(e.target.value);
                }}
              />
            </label>
            <BindingFindings findings={save.findings} name={name} />
            {save.findings
              .filter((f) =>
                ["environment", "item", "project"].some((m) => f.location.endsWith(`/${m}`)),
              )
              .map((f) => (
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
              disabled={save.busy || !project || !projects}
              onClick={() =>
                void save.send(
                  {
                    kind: "t3code-project",
                    mode: original ? "replace" : "add",
                    name,
                    environment,
                    project,
                    item,
                  },
                  original
                    ? `Update T3code project binding ${name}`
                    : `Bind T3code project ${choices?.find((p) => p.id === project)?.title ?? project} as ${name}`,
                )
              }
            >
              {save.busy ? "Saving…" : save.error ? "Try again" : original ? "Save" : "Bind"}
            </Button>
          ) : null}
        </div>
      </DialogPopup>
    </Dialog>
  );
}
