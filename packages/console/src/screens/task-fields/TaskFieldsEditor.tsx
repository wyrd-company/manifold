// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { diff } from "@codemirror/merge";
import type {
  DeclarationSourceResponse,
  DeclarationFindings,
  SaveConflictResponse,
  DeclarationFinding,
  TaskField,
  TaskFieldEdit,
} from "@wyrd-company/manifold-shared/declarations-api";
import {
  fetchDeclarationSource,
  fetchBindings,
  lintDeclarationText,
  saveDeclaration,
} from "../../api/declarations.ts";
import { Button } from "../../ui/button.tsx";
import {
  changeDraft,
  createSaveId,
  readDraft,
  writeDraft,
  savedDraft,
  settleDraft,
} from "../blueprints/draft.ts";
import type { BlueprintDraft } from "../blueprints/draft.ts";
import { SourcePane } from "../blueprints/SourcePane.tsx";
import { SchemaEditor } from "./SchemaEditor.tsx";
import { ImpactTable } from "./ImpactTable.tsx";
import { fieldAtCursor } from "./fields.ts";
import { editTaskFields } from "../../api/declarations.ts";
import { fetchProjects } from "../../api/projects.ts";
import { ProblemsStrip } from "../blueprints/ProblemsStrip.tsx";
import { PublishDialog } from "../blueprints/PublishDialog.tsx";
import { DiscardDialog } from "../blueprints/DiscardDialog.tsx";
import { CompareDialog } from "../blueprints/ConflictAlert.tsx";
const path = "task-metadata.yml" as const;
const prefix = "manifold.declaration-draft.";
export function TaskFieldsEditor() {
  const query = useQuery({
    queryKey: ["declaration", path],
    queryFn: () => fetchDeclarationSource(path),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const result = query.data;
  if (!result)
    return (
      <>
        <h2>Task fields</h2>
        <p role="status">Loading task fields…</p>
      </>
    );
  if (result.kind !== "ok")
    return (
      <>
        <h2>Task fields</h2>
        <div role="alert" className="error-alert">
          {"message" in result ? result.message : "Cannot read task fields."}
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      </>
    );
  return <Editor source={result.body} />;
}
function Editor({ source: initialSource }: { source: DeclarationSourceResponse }) {
  const client = useQueryClient();
  const repositoryQuery = useQuery({
    queryKey: ["bindings"],
    queryFn: fetchBindings,
    retry: false,
  });
  const repository =
    repositoryQuery.data?.kind === "ok"
      ? repositoryQuery.data.body.repository
      : { url: "", branch: "branch" };
  const [source, setSource] = useState(initialSource);
  const [draft, setDraft] = useState<BlueprintDraft>(() => {
    const stored = readDraft(localStorage, path, prefix);
    const settled = stored ? settleDraft(stored, initialSource, false) : undefined;
    writeDraft(localStorage, path, settled, prefix);
    return (
      settled ?? {
        base: initialSource.commit ?? "",
        baseText: initialSource.text,
        text: initialSource.text,
      }
    );
  });
  const current = useRef(draft);
  const [lint, setLint] = useState<{ text: string; body: DeclarationFindings }>({
    text: initialSource.text,
    body: initialSource,
  });
  const [checking, setChecking] = useState(false);
  const [lintFailed, setLintFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [cursor, setCursor] = useState<number>();
  const [publish, setPublish] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [compare, setCompare] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState<SaveConflictResponse>();
  const [later, setLater] = useState<string>();
  const [toast, setToast] = useState<string>();
  const [tab, setTab] = useState("visual");
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: fetchProjects, retry: false });
  const projects = projectsQuery.data?.kind === "ok" ? projectsQuery.data.body.projects : [];
  const [fields, setFields] = useState<readonly TaskField[]>(initialSource.fields ?? []);
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState(false);
  const lastEdit = useRef<{ text: string; edit: TaskFieldEdit } | undefined>(undefined);
  const acceptLint = (text: string, body: DeclarationFindings) => {
    setLint({ text, body });
    if (body.fields) setFields(body.fields);
  };
  const update = (next: BlueprintDraft) => {
    if (next.text === lint.text) {
      setRetry(0);
      setChecking(false);
      setLintFailed(false);
    }
    current.current = next;
    writeDraft(localStorage, path, next, prefix);
    setDraft(next);
  };
  useEffect(() => {
    if (draft.saved || (draft.text === lint.text && !retry)) return;
    // Lint is an external service request; state tracks its in-flight status.
    const controller = new AbortController();
    const text = draft.text;
    const timer = setTimeout(() => {
      setChecking(true);
      void lintDeclarationText(path, text, controller.signal).then((answer) => {
        if (controller.signal.aborted || current.current.text !== text) return;
        setChecking(false);
        if (answer.kind === "ok") {
          setRetry(0);
          setLint({ text, body: answer.body });
          if (answer.body.fields) setFields(answer.body.fields);
          setLintFailed(false);
        } else setLintFailed(true);
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft.text, draft.saved, retry, lint.text]);
  const changes = diff(draft.baseText, draft.text).reduce(
    (sum, change) =>
      sum +
      Math.max(
        draft.baseText.slice(change.fromA, change.toA).split("\n").length,
        draft.text.slice(change.fromB, change.toB).split("\n").length,
      ),
    0,
  );
  const changed = draft.text !== draft.baseText;
  const pending = !!draft.saved;
  const loadSource = async (saved: BlueprintDraft, loaded: boolean) => {
    const fresh = await fetchDeclarationSource(path);
    if (fresh.kind !== "ok") {
      setError("Cannot load the saved version. Your text is kept.");
      return;
    }
    setSource(fresh.body);
    const next = settleDraft(saved, fresh.body, loaded);
    if (next && !next.saved && saved.saved)
      setLater(
        `Saved as ${saved.saved.slice(0, 7)}. ${repository.branch} changed this file since, at ${fresh.body.commit?.slice(0, 7)}. Your saved text is kept as a draft.`,
      );
    update(
      next ?? { base: fresh.body.commit ?? "", baseText: fresh.body.text, text: fresh.body.text },
    );
    acceptLint(fresh.body.text, fresh.body);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["projects"] }),
      client.invalidateQueries({ queryKey: ["declaration", path] }),
    ]);
  };
  const sendSave = async () => {
    let attempt = current.current;
    const commitMessage = pending ? (attempt.message ?? message) : message;
    if (!attempt.saveId) {
      attempt = { ...attempt, saveId: createSaveId(), message: commitMessage };
      update(attempt);
    } else if (!pending && attempt.message !== commitMessage) {
      attempt = { ...attempt, saveId: createSaveId(), message: commitMessage };
      update(attempt);
    }
    setBusy(true);
    setError(undefined);
    const answer = await saveDeclaration({
      path,
      base: attempt.base,
      text: attempt.text,
      message: attempt.message ?? commitMessage,
      saveId: attempt.saveId!,
    });
    if (answer.kind === "ok") {
      const saved = savedDraft(attempt, answer.body.commit);
      update(saved);
      setPublish(false);
      setConflict(undefined);
      setToast(
        answer.body.outcome === "unchanged"
          ? "No change to save"
          : `${answer.body.outcome === "already-saved" ? "Already saved" : "Saved"} as ${answer.body.commit.slice(0, 7)}`,
      );
      if (answer.body.loaded) await loadSource(saved, true);
    } else if (answer.kind === "conflict") {
      setPublish(false);
      setConflict(answer.body);
    } else if (answer.kind === "invalid") {
      setPublish(false);
      acceptLint(attempt.text, answer.body);
    } else setError(answer.message);
    setBusy(false);
  };
  const change = (text: string) => {
    if (text === current.current.text) return;
    update(changeDraft(current.current, text));
    setLater(undefined);
  };
  async function sendEdit(edit: TaskFieldEdit, retry = false) {
    const request =
      retry && lastEdit.current ? lastEdit.current : { text: current.current.text, edit };
    lastEdit.current = request;
    setEditing(true);
    setEditError(false);
    const answer = await editTaskFields(request);
    if (current.current.text === request.text) {
      if (answer.kind === "ok") {
        change(answer.body.text);
        acceptLint(answer.body.text, answer.body);
        setSelected(answer.body.location);
      } else if (answer.kind === "invalid")
        acceptLint(request.text, {
          ...lint.body,
          findings: answer.body.findings,
          warnings: answer.body.warnings,
        });
      else setEditError(true);
    }
    setEditing(false);
  }
  const selectFinding = (finding: DeclarationFinding) => {
    setTab("yaml");
    setCursor(finding.range?.from);
    setSelected(
      fields.find(
        (f) => finding.location === f.location || finding.location.startsWith(f.location + "/"),
      )?.location,
    );
  };
  return (
    <div className="blueprint-editor task-fields-editor">
      <header className="blueprint-editor-header task-fields-heading">
        <div>
          <h2>Task fields</h2>
          <p className="muted">The fields Manifold keeps on each bound Project's tasks.</p>
        </div>
        {changed ? <span className="warning-text">Draft · {changes} changes</span> : null}
        <div className="blueprint-header-actions">
          {changed || pending ? (
            <Button variant="ghost" disabled={busy || editing} onClick={() => setDiscard(true)}>
              Discard draft
            </Button>
          ) : null}
          {!pending ? (
            <Button
              disabled={
                !changed ||
                checking ||
                editing ||
                lintFailed ||
                lint.text !== draft.text ||
                lint.body.findings.length > 0 ||
                !draft.base
              }
              onClick={() => {
                setMessage(draft.message ?? `${source.exists ? "Update" : "Add"} task fields`);
                setError(undefined);
                setPublish(true);
              }}
            >
              Publish
            </Button>
          ) : null}
        </div>
      </header>
      <div className="task-fields-version mono muted">
        Published {source.commit.slice(0, 7)} · task-metadata.yml{" "}
        {lint.body.impact ? (
          <>
            <span>Changes {lint.body.impact.length} bound Projects</span>
            <Button
              variant="ghost"
              disabled={lint.text !== draft.text || checking}
              onClick={() => {
                setMessage(draft.message ?? `${source.exists ? "Update" : "Add"} task fields`);
                setPublish(true);
              }}
            >
              Review impact
            </Button>
          </>
        ) : null}
      </div>
      {toast ? (
        <p role="status" className="success-text">
          {toast}
        </p>
      ) : null}
      {pending ? (
        <div className="blueprint-info" role="status">
          Saved as {draft.saved?.slice(0, 7)}. The service has not loaded it yet. Your text is kept.{" "}
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              void sendSave();
            }}
          >
            Load saved version
          </Button>
          {error ? <p role="alert">{error}</p> : null}
        </div>
      ) : later ? (
        <div className="blueprint-info">
          {later}
          <Button variant="outline" onClick={() => setCompare(true)}>
            Compare
          </Button>
        </div>
      ) : source.commit && source.commit !== draft.base ? (
        <p className="blueprint-info">
          A newer version exists. Publishing keeps changes made since, unless they changed this
          file.
        </p>
      ) : null}
      {conflict ? (
        <div role="alert" className="error-alert">
          {conflict.reason === "file-changed"
            ? `${path} changed on ${repository.branch} at ${conflict.head.slice(0, 7)}. Your text is kept.`
            : `${repository.branch} moved while saving, at ${conflict.head.slice(0, 7)}. Your text is kept. Publish again.`}
          <div>
            <Button variant="outline" onClick={() => setCompare(true)}>
              Compare
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                update({
                  base: conflict.head,
                  baseText: conflict.text ?? source.text,
                  text: draft.text,
                });
                setConflict(undefined);
              }}
            >
              Use latest as base
            </Button>
            <Button variant="ghost" onClick={() => setDiscard(true)}>
              Discard draft
            </Button>
          </div>
        </div>
      ) : null}
      <div className="blueprint-tabs" role="tablist" aria-label="Task fields editor">
        <Button
          variant="ghost"
          role="tab"
          aria-selected={tab === "visual"}
          onClick={() => setTab("visual")}
        >
          Visual
        </Button>
        <Button
          variant="ghost"
          role="tab"
          aria-selected={tab === "yaml"}
          onClick={() => setTab("yaml")}
        >
          YAML
        </Button>
      </div>
      {tab === "visual" ? (
        <SchemaEditor
          fields={fields}
          lint={lint.body}
          projects={projects}
          selected={selected}
          disabled={
            pending || busy || editing || lint.body.fields === undefined || lint.text !== draft.text
          }
          onSelect={(field) => {
            setSelected(field.location);
            setCursor(field.range?.from);
          }}
          onEdit={(edit) => void sendEdit(edit)}
        />
      ) : (
        <div className="task-fields-yaml">
          <SourcePane
            path={path}
            text={draft.text}
            baseText={draft.baseText}
            findings={lint.body.findings}
            warnings={lint.body.warnings}
            readOnly={pending || busy || editing}
            onChange={change}
            cursor={cursor}
            onCursor={(position) => setSelected(fieldAtCursor(position, fields)?.location)}
          />
        </div>
      )}
      {editError ? (
        <p role="alert" className="error-alert">
          Cannot apply this change. Try again.{" "}
          <Button
            onClick={() => {
              if (lastEdit.current) void sendEdit(lastEdit.current.edit, true);
            }}
          >
            Try again
          </Button>
        </p>
      ) : null}
      <ProblemsStrip
        findings={lint.body.findings}
        warnings={lint.body.warnings}
        states={[]}
        checking={checking || editing || lint.text !== draft.text}
        failed={lintFailed}
        onRetry={() => setRetry((value) => value + 1)}
        onSelect={selectFinding}
      />
      <PublishDialog
        open={publish}
        title="Publish task fields"
        publishDisabled={
          !changed ||
          checking ||
          editing ||
          lintFailed ||
          lint.text !== draft.text ||
          lint.body.findings.length > 0
        }
        width={lint.body.impact?.length ? 660 : 480}
        path={path}
        added={!source.exists}
        repository={repository}
        message={message}
        onMessage={setMessage}
        busy={busy}
        error={error}
        onClose={() => setPublish(false)}
        onPublish={() => {
          void sendSave();
        }}
      >
        <ImpactTable impact={lint.body.impact ?? []} projects={projects} />
      </PublishDialog>
      <DiscardDialog
        open={discard}
        changes={changes}
        commit={source.commit ?? draft.base}
        onClose={() => setDiscard(false)}
        onDiscard={() => {
          writeDraft(localStorage, path, undefined, prefix);
          setDiscard(false);
          setConflict(undefined);
          setLater(undefined);
          void fetchDeclarationSource(path).then((answer) => {
            if (answer.kind === "ok") {
              setSource(answer.body);
              update({
                base: answer.body.commit ?? "",
                baseText: answer.body.text,
                text: answer.body.text,
              });
              acceptLint(answer.body.text, answer.body);
            }
          });
        }}
      />
      <CompareDialog
        open={compare}
        latest={conflict?.text ?? source.text}
        text={draft.text}
        onChange={change}
        onClose={() => setCompare(false)}
      />
    </div>
  );
}
