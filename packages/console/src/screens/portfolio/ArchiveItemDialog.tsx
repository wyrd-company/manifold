// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  ArchiveItemRequest,
  SaveDeclarationResponse,
} from "@wyrd-company/manifold-shared/declarations-api";
import type { PortfolioItem, PortfolioResponse } from "@wyrd-company/manifold-shared/portfolio-api";
import { archiveItem, fetchBindings } from "../../api/declarations.ts";
import type { DeclarationResult } from "../../api/declarations.ts";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { createSaveId } from "../blueprints/draft.ts";
import { attachedBindings, siblingTargets, archiveRequest } from "./archive.ts";
import type { ArchiveChoices } from "./archive.ts";
export function ArchiveItemDialog({
  item,
  read,
  onClose,
  onSaved,
}: {
  item: PortfolioItem;
  read: PortfolioResponse;
  onClose: () => void;
  onSaved: (request: ArchiveItemRequest, answer: SaveDeclarationResponse) => void;
}) {
  const query = useQuery({ queryKey: ["bindings"], queryFn: fetchBindings, retry: false });
  const [choices, setChoices] = useState<ArchiveChoices>({}),
    [saveId, setSaveId] = useState(createSaveId),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<DeclarationResult<SaveDeclarationResponse>>();
  const bindings = query.data?.kind === "ok" ? query.data.body : undefined;
  const attached = bindings ? attachedBindings(read, bindings, item.id) : [];
  const siblings = bindings ? siblingTargets(read, bindings, item.id) : [];
  const parent = read.items.find((i) => i.id === item.parent);
  const candidate =
    bindings && !bindings.findings.length
      ? archiveRequest(item.id, attached, choices, bindings.commit, saveId)
      : undefined;
  const request = candidate?.projects.every(
    (choice) => choice.choice !== "reassign" || siblings.some((item) => item.id === choice.item),
  )
    ? candidate
    : undefined;
  function choose(name: string, choice: ArchiveChoices[string]) {
    setChoices((previous) => ({ ...previous, [name]: choice }));
    setSaveId(createSaveId());
    setResult(undefined);
  }
  async function submit() {
    if (!request || busy) return;
    setBusy(true);
    const answer = await archiveItem(request);
    setBusy(false);
    if (answer.kind === "ok") onSaved(request, answer.body);
    else setResult(answer);
  }
  async function readAgain() {
    const fresh = await query.refetch();
    if (fresh.data?.kind === "ok") {
      const names = new Set(attachedBindings(read, fresh.data.body, item.id).map((b) => b.name));
      setChoices((previous) =>
        Object.fromEntries(Object.entries(previous).filter(([name]) => names.has(name))),
      );
      setSaveId(createSaveId());
      setResult(undefined);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 480 }} showCloseButton={!busy}>
        <DialogTitle>Archive {item.title}</DialogTitle>
        <DialogDescription>
          Choose where each project goes. The archive and every choice are saved in one commit.
        </DialogDescription>
        {query.isPending ? <p role="status">Loading projects…</p> : null}
        {query.data?.kind === "failed" ? (
          <div role="alert" className="error-alert">
            {query.data.message}
            <Button onClick={() => void query.refetch()}>Try again</Button>
          </div>
        ) : null}
        {bindings?.findings.length ? (
          <div role="alert" className="error-alert">
            {bindings.findings.map((f) => (
              <p key={f.location}>{f.message}</p>
            ))}
          </div>
        ) : null}
        {attached.map((binding) => (
          <fieldset key={binding.name} className="portfolio-archive-project" disabled={busy}>
            <legend>{binding.name}</legend>
            <p className="muted">
              {binding.kind === "github"
                ? `${binding.owner}/${binding.number}`
                : `${binding.environment} · ${binding.project}`}
            </p>
            {binding.item !== item.id ? (
              <p className="muted">
                on {read.items.find((i) => i.id === binding.item)?.title ?? binding.item}
              </p>
            ) : null}
            {binding.kind === "github" && binding.t3codeProjects.length ? (
              <p className="muted">
                and {binding.t3codeProjects.length} associated T3code projects
              </p>
            ) : null}
            {parent ? (
              <label>
                <input
                  type="radio"
                  name={binding.name}
                  checked={choices[binding.name]?.choice === "move"}
                  onChange={() => choose(binding.name, { choice: "move" })}
                />
                Move to {parent.title}
              </label>
            ) : null}
            <label>
              <input
                type="radio"
                name={binding.name}
                disabled={!siblings.length}
                checked={choices[binding.name]?.choice === "reassign"}
                onChange={() => choose(binding.name, { choice: "reassign", item: "" })}
              />
              Reassign to
            </label>
            <select
              aria-label={`Reassign ${binding.name} to`}
              disabled={busy || !siblings.length || choices[binding.name]?.choice !== "reassign"}
              value={selectedTarget(choices[binding.name])}
              onChange={(event) =>
                choose(binding.name, { choice: "reassign", item: event.target.value })
              }
            >
              <option value="">Choose a sibling</option>
              {siblings.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title ?? i.id}
                </option>
              ))}
            </select>
            {!siblings.length ? <small className="muted">No sibling</small> : null}
            <label>
              <input
                type="radio"
                name={binding.name}
                checked={choices[binding.name]?.choice === "archive"}
                onChange={() => choose(binding.name, { choice: "archive" })}
              />
              Archive project
            </label>
          </fieldset>
        ))}
        {result?.kind === "conflict" ? (
          <div role="alert" className="error-alert">
            portfolio.yml or bindings.yml changed on {bindings?.repository.branch} at{" "}
            {result.body.head.slice(0, 7)}.
            <Button onClick={() => void readAgain()}>Read again</Button>
          </div>
        ) : result?.kind === "invalid" ? (
          <div role="alert" className="error-alert">
            {result.body.findings.map((finding) => (
              <p
                key={`${finding.file ?? ""}:${finding.kind}:${finding.location}:${finding.message}`}
              >
                <span className="mono">
                  {finding.kind} {finding.file}
                </span>{" "}
                {finding.message}
              </p>
            ))}
          </div>
        ) : result?.kind === "failed" ? (
          <div role="alert" className="error-alert">
            {result.message}
            <Button onClick={() => void submit()}>Try again</Button>
          </div>
        ) : null}
        <div className="blueprint-dialog-actions">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            className="portfolio-confirm-archive"
            disabled={!request || busy || result?.kind === "conflict"}
            onClick={() => void submit()}
          >
            Archive {item.title}
          </Button>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

function selectedTarget(choice: ArchiveChoices[string] | undefined) {
  return choice?.choice === "reassign" ? choice.item : "";
}
