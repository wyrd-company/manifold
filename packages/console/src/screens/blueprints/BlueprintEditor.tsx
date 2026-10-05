// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { diff } from "@codemirror/merge";
import type {
  BlueprintSourceResponse,
  LintResponse,
  SaveConflictResponse,
  ApiFinding,
} from "@wyrd-company/manifold-shared/blueprints-api";
import {
  fetchBlueprintSource,
  fetchBlueprints,
  lintBlueprintText,
  saveBlueprint,
} from "../../api/blueprints.ts";
import { Button } from "../../ui/button.tsx";
import {
  changeDraft,
  createSaveId,
  readDraft,
  writeDraft,
  savedDraft,
  settleDraft,
} from "./draft.ts";
import type { BlueprintDraft } from "./draft.ts";
import { SourcePane } from "./SourcePane.tsx";
import { GraphPane } from "./GraphPane.tsx";
import { ProblemsStrip } from "./ProblemsStrip.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { DiscardDialog } from "./DiscardDialog.tsx";
import { CompareDialog } from "./ConflictAlert.tsx";
import { findingState, stateAtCursor } from "./problems.ts";
export function BlueprintEditor({ path }: { path: string }) {
  const query = useQuery({
    queryKey: ["blueprint-source", path],
    queryFn: () => fetchBlueprintSource(path),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const result = query.data;
  if (!result) return <p role="status">Loading blueprint…</p>;
  if (result.kind !== "ok")
    return (
      <div role="alert" className="error-alert">
        {"message" in result ? result.message : "Cannot read blueprint."}
        <Button
          onClick={() => {
            void query.refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  return <Editor key={path} path={path} source={result.body} />;
}
function Editor({
  path,
  source: initialSource,
}: {
  path: string;
  source: BlueprintSourceResponse;
}) {
  const client = useQueryClient();
  const repositoryQuery = useQuery({
    queryKey: ["blueprints"],
    queryFn: fetchBlueprints,
    retry: false,
  });
  const repository =
    repositoryQuery.data?.kind === "ok"
      ? repositoryQuery.data.body.repository
      : { url: "", branch: "branch" };
  const [source, setSource] = useState(initialSource);
  const [draft, setDraft] = useState<BlueprintDraft>(() => {
    const stored = readDraft(localStorage, path);
    const settled = stored ? settleDraft(stored, initialSource, false) : undefined;
    writeDraft(localStorage, path, settled);
    return (
      settled ?? {
        base: initialSource.commit ?? "",
        baseText: initialSource.text,
        text: initialSource.text,
      }
    );
  });
  const current = useRef(draft);
  const [lint, setLint] = useState<{ text: string; body: LintResponse }>({
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
  const [tab, setTab] = useState("source");
  const update = (next: BlueprintDraft) => {
    if (next.text === lint.text) {
      setRetry(0);
      setChecking(false);
      setLintFailed(false);
    }
    current.current = next;
    writeDraft(localStorage, path, next);
    setDraft(next);
  };
  useEffect(() => {
    if (draft.saved || (draft.text === lint.text && !retry)) return;
    // Lint is an external service request; state tracks its in-flight status.
    const controller = new AbortController();
    const text = draft.text;
    const timer = setTimeout(() => {
      setChecking(true);
      void lintBlueprintText(path, text, controller.signal).then((answer) => {
        if (controller.signal.aborted || current.current.text !== text) return;
        setChecking(false);
        if (answer.kind === "ok") {
          setRetry(0);
          setLint({ text, body: answer.body });
          setLintFailed(false);
        } else setLintFailed(true);
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft.text, draft.saved, path, retry, lint.text]);
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
    const fresh = await fetchBlueprintSource(path);
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
    setLint({ text: fresh.body.text, body: fresh.body });
    await client.invalidateQueries({ queryKey: ["blueprints"] });
  };
  const sendSave = async () => {
    let attempt = current.current;
    const commitMessage = pending ? (attempt.message ?? message) : message;
    if (!attempt.saveId) {
      attempt = { ...attempt, saveId: createSaveId(), message: commitMessage };
      update(attempt);
    } else if (!pending && attempt.message !== commitMessage) {
      attempt = { ...attempt, message: commitMessage };
      update(attempt);
    }
    setBusy(true);
    setError(undefined);
    const answer = await saveBlueprint({
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
      if (answer.body.blueprint) await loadSource(saved, true);
    } else if (answer.kind === "conflict") {
      setPublish(false);
      setConflict(answer.body);
    } else if (answer.kind === "invalid") {
      setPublish(false);
      setLint({ text: attempt.text, body: answer.body });
    } else setError(answer.message);
    setBusy(false);
  };
  const change = (text: string) => {
    if (text === current.current.text) return;
    update(changeDraft(current.current, text));
    setLater(undefined);
  };
  const selectFinding = (finding: ApiFinding) => {
    setCursor(finding.range?.from);
    setSelected(findingState(finding, lint.body.graph?.states ?? []));
  };
  return (
    <div className="blueprint-editor">
      <header className="blueprint-editor-header">
        <span className="mono">{path}</span>
        <span className="mono muted">
          {source.source === "bundled"
            ? `Bundled ${source.bundle?.slice(0, 7)}`
            : `Based on ${draft.base.slice(0, 7)}`}
        </span>
        {changed ? <span className="warning-text">Draft · {changes} changes</span> : null}
        <div className="blueprint-header-actions">
          {changed || pending ? (
            <Button variant="ghost" onClick={() => setDiscard(true)}>
              Discard draft
            </Button>
          ) : null}
          {!pending ? (
            <Button
              disabled={
                !changed ||
                checking ||
                lintFailed ||
                lint.text !== draft.text ||
                lint.body.findings.length > 0 ||
                !draft.base
              }
              onClick={() => {
                setMessage(
                  draft.message ?? `${source.source === "bundled" ? "Add" : "Update"} ${path}`,
                );
                setError(undefined);
                setPublish(true);
              }}
            >
              Publish
            </Button>
          ) : null}
        </div>
      </header>
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
      <div className="blueprint-tabs">
        <Button variant="ghost" onClick={() => setTab("source")}>
          Source
        </Button>
        <Button variant="ghost" onClick={() => setTab("graph")}>
          Graph
        </Button>
      </div>
      <div className={`blueprint-panes tab-${tab}`}>
        <SourcePane
          path={path}
          text={draft.text}
          baseText={draft.baseText}
          findings={lint.body.findings}
          warnings={lint.body.warnings}
          readOnly={pending}
          onChange={change}
          cursor={cursor}
          onCursor={(position) =>
            setSelected(stateAtCursor(position, lint.body.graph?.states ?? []))
          }
        />
        <GraphPane
          graph={lint.body.graph}
          findings={lint.body.findings}
          warnings={lint.body.warnings}
          selected={selected}
          onSelect={(state) => {
            setSelected(state);
            setCursor(lint.body.graph?.states.find((item) => item.path === state)?.range?.from);
          }}
        />
      </div>
      <ProblemsStrip
        findings={lint.body.findings}
        warnings={lint.body.warnings}
        states={lint.body.graph?.states ?? []}
        checking={checking || lint.text !== draft.text}
        failed={lintFailed}
        onRetry={() => setRetry((value) => value + 1)}
        onSelect={selectFinding}
      />
      <PublishDialog
        open={publish}
        path={path}
        added={source.source === "bundled"}
        repository={repository}
        message={message}
        onMessage={setMessage}
        busy={busy}
        error={error}
        onClose={() => setPublish(false)}
        onPublish={() => {
          void sendSave();
        }}
      />
      <DiscardDialog
        open={discard}
        changes={changes}
        commit={source.commit ?? draft.base}
        onClose={() => setDiscard(false)}
        onDiscard={() => {
          writeDraft(localStorage, path, undefined);
          setDiscard(false);
          setConflict(undefined);
          setLater(undefined);
          void fetchBlueprintSource(path).then((answer) => {
            if (answer.kind === "ok") {
              setSource(answer.body);
              update({
                base: answer.body.commit ?? "",
                baseText: answer.body.text,
                text: answer.body.text,
              });
              setLint({ text: answer.body.text, body: answer.body });
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
