// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useEffectEvent, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { blueprintGraph } from "@wyrd-company/manifold-shared/blueprint-graph";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { diff } from "@codemirror/merge";
import type {
  BlueprintSourceResponse,
  LintResponse,
  ApiFinding,
} from "@wyrd-company/manifold-shared/blueprints-api";
import { fetchBlueprintSource, fetchBlueprints, lintBlueprintText } from "../../api/blueprints.ts";
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
import { BlueprintCanvasEditor } from "./BlueprintCanvasEditor.tsx";
import { ProblemsStrip } from "./ProblemsStrip.tsx";
import { PublishDialog } from "./PublishDialog.tsx";
import { DiscardDialog } from "./DiscardDialog.tsx";
import { CompareDialog } from "./ConflictAlert.tsx";
import { findingSelection, cursorForSelection, selectionAtCursor } from "./problems.ts";
import {
  fetchDecisionModels,
  fetchDecisionModel,
  lintDecisionModelText,
  publishFiles,
} from "../../api/declarations.ts";
import type { PublishConflictResponse } from "@wyrd-company/manifold-shared/declarations-api";
import { ModelDraftContext } from "./decision-model/ModelDraftContext.tsx";
import { applyModelDraft, changedFiles, settleModelDraft } from "./decision-model/model-drafts.ts";
import type { ModelDraft } from "./decision-model/model-drafts.ts";
const DecisionModelDialog = lazy(() => import("./decision-model/DecisionModelDialog.tsx"));
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
  const modelsQuery = useQuery({
    queryKey: ["decision-models"],
    queryFn: fetchDecisionModels,
    retry: false,
  });
  const modelList = modelsQuery.data?.kind === "ok" ? modelsQuery.data.body : undefined;
  const [openModel, setOpenModel] = useState<{
    path: string;
    source: ModelDraft;
    cursor?: number;
  }>();
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
  const [lint, setLint] = useState<{
    text: string;
    body: LintResponse;
    models: string;
    base: string;
  }>({
    text: initialSource.text,
    body: initialSource,
    models: "{}",
    base: initialSource.commit ?? "",
  });
  const [checking, setChecking] = useState(false);
  const [lintFailed, setLintFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [cursor, setCursor] = useState<number>();
  const [publish, setPublish] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [compare, setCompare] = useState(false);
  const [comparePath, setComparePath] = useState(path);
  const [latestModels, setLatestModels] = useState<
    Record<string, { text: string; exists: boolean }>
  >({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [conflict, setConflict] = useState<PublishConflictResponse>();
  const [later, setLater] = useState<string>();
  const [toast, setToast] = useState<string>();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const tab = search.view === "yaml" ? "yaml" : "canvas";
  const graph = useMemo(() => blueprintGraph(draft.text), [draft.text]);
  const setTab = (next: "canvas" | "yaml") => {
    if (next === "yaml") setCursor(cursorForSelection(selected, draft.text));
    void navigate({
      to: "/blueprints/$",
      params: { _splat: path },
      search: { view: next === "yaml" ? "yaml" : undefined },
    });
  };
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
  const modelKey = JSON.stringify(draft.models ?? {});
  const lintCurrent =
    lint.text === draft.text && lint.models === modelKey && lint.base === draft.base;
  useEffect(() => {
    if (draft.saved || (lintCurrent && !retry)) return;
    // Lint is an external service request; state tracks its in-flight status.
    const controller = new AbortController();
    const attempt = draft;
    const text = draft.text;
    const models = Object.entries(attempt.models ?? {}).map(([path, model]) => ({
      path,
      text: model.text,
    }));
    const timer = setTimeout(() => {
      setChecking(true);
      void Promise.all([
        lintBlueprintText(path, text, controller.signal, {
          base: attempt.base,
          models,
        }),
        ...models.map((model) =>
          lintDecisionModelText(
            {
              ...model,
              base: attempt.base,
              models: models.filter((m) => m.path !== model.path),
            },
            controller.signal,
          ),
        ),
      ]).then((answers) => {
        if (controller.signal.aborted || current.current !== attempt) return;
        setChecking(false);
        const blueprint = answers[0]!;
        if (answers.every((answer) => answer.kind === "ok") && blueprint.kind === "ok") {
          const modelAnswers = answers
            .slice(1)
            .flatMap((answer) => (answer.kind === "ok" ? [answer.body] : []));
          setRetry(0);
          setLint({
            text,
            models: modelKey,
            base: attempt.base,
            body: {
              ...blueprint.body,
              findings: [
                ...blueprint.body.findings,
                ...modelAnswers.flatMap((a) => ("findings" in a ? a.findings : [])),
              ],
              warnings: [
                ...blueprint.body.warnings,
                ...modelAnswers.flatMap((a) => ("warnings" in a ? a.warnings : [])),
              ],
            },
          });
          setLintFailed(false);
        } else setLintFailed(true);
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [draft, path, retry, lintCurrent, modelKey]);
  const files = changedFiles(path, draft, source.source === "bundled");
  const lineChanges = (base: string, text: string) =>
    diff(base, text).reduce(
      (sum, change) =>
        sum +
        Math.max(
          base.slice(change.fromA, change.toA).split("\n").length,
          text.slice(change.fromB, change.toB).split("\n").length,
        ),
      0,
    );
  const changes =
    lineChanges(draft.baseText, draft.text) +
    Object.values(draft.models ?? {}).reduce(
      (sum, model) => sum + lineChanges(model.baseText, model.text),
      0,
    );
  const changed = files.length > 0;
  const pending = !!draft.saved;
  const loadSource = async (saved: BlueprintDraft, loaded: boolean) => {
    const fresh = await fetchBlueprintSource(path);
    if (fresh.kind !== "ok") {
      setError("Cannot load the saved version. Your text is kept.");
      return;
    }
    setSource(fresh.body);
    const modelSources = await Promise.all(
      Object.keys(saved.models ?? {}).map(async (path) => ({
        path,
        result: await fetchDecisionModel(path, fresh.body.commit),
      })),
    );
    if (modelSources.some((source) => source.result.kind !== "ok")) {
      setError("Cannot load the saved version. Your text is kept.");
      return;
    }
    const sources = Object.fromEntries(
      modelSources.flatMap((source) =>
        source.result.kind === "ok" ? [[source.path, source.result.body]] : [],
      ),
    );
    setLatestModels(sources);
    const next = settleModelDraft(saved, fresh.body, sources, loaded);
    if (next && !next.saved && saved.saved)
      setLater(
        `Saved as ${saved.saved.slice(0, 7)}. ${repository.branch} changed ${[...(fresh.body.text !== saved.text ? [path] : []), ...Object.keys(saved.models ?? {}).filter((path) => sources[path]?.text !== saved.models![path]!.text)].join(", ")} since, at ${fresh.body.commit?.slice(0, 7)}. Your saved text is kept as a draft.`,
      );
    update(
      next ?? {
        base: fresh.body.commit ?? "",
        baseText: fresh.body.text,
        text: fresh.body.text,
      },
    );
    setLint({
      text: fresh.body.text,
      body: fresh.body,
      models: "{}",
      base: fresh.body.commit ?? "",
    });
    await client.invalidateQueries({ queryKey: ["decision-models"] });
    await client.invalidateQueries({ queryKey: ["decision-model"] });
    await client.invalidateQueries({ queryKey: ["blueprints"] });
    await client.invalidateQueries({ queryKey: ["blueprint-source", path] });
  };
  const recoverPending = useEffectEvent(() => {
    const stored = current.current;
    if (stored.saved)
      void loadSource(
        stored,
        initialSource.commit === stored.saved || initialSource.commit !== stored.base,
      );
  });
  useEffect(() => {
    recoverPending();
  }, []);
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
    const answer = await publishFiles({
      base: attempt.base,
      files: changedFiles(path, attempt, source.source === "bundled").map(({ path, text }) => ({
        path,
        text,
      })),
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
      setLint({
        text: attempt.text,
        body: answer.body,
        models: JSON.stringify(attempt.models ?? {}),
        base: attempt.base,
      });
    } else setError(answer.message);
    setBusy(false);
  };
  const change = (text: string) => {
    if (text === current.current.text) return;
    update(changeDraft(current.current, text));
    setLater(undefined);
  };
  const selectFinding = (finding: ApiFinding) => {
    if (typeof finding["file"] === "string" && finding["file"] !== path) {
      const modelPath = finding["file"];
      void fetchDecisionModel(modelPath, draft.base).then((answer) => {
        if (answer.kind === "ok")
          setOpenModel({
            path: modelPath,
            source: draft.models?.[modelPath] ?? {
              baseText: answer.body.text,
              text: answer.body.text,
              exists: answer.body.exists,
            },
            ...(finding.range ? { cursor: finding.range.from } : {}),
          });
      });
      return;
    }
    setCursor(finding.range?.from);
    setSelected(lint.body.graph ? findingSelection(finding, lint.body.graph) : undefined);
  };
  return (
    <ModelDraftContext
      value={{
        base: draft.base,
        models: draft.models ?? {},
        readOnly: pending,
        ...(lintCurrent && lint
          ? { problems: [...lint.body.findings, ...lint.body.warnings] }
          : {}),
        paths:
          modelList?.models
            .filter((model) => model.path.startsWith("decision-models/"))
            .map((model) => model.path) ?? [],
        ...(modelList?.intake ? { intake: modelList.intake } : {}),
        open: (path, source) => setOpenModel({ path, source }),
        apply: (path, source) => update(applyModelDraft(current.current, path, source)),
      }}
    >
      <div
        className="blueprint-editor"
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "y"
          ) {
            event.preventDefault();
            setTab(tab === "canvas" ? "yaml" : "canvas");
          }
        }}
      >
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
                  !lintCurrent ||
                  lint.body.findings.length > 0 ||
                  !draft.base
                }
                onClick={() => {
                  setMessage(
                    draft.message ??
                      (files.length === 1
                        ? `${files[0]!.added ? "Add" : "Update"} ${files[0]!.path}`
                        : `Update ${path} and ${Object.keys(draft.models ?? {}).length} decision models`),
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
            Saved as {draft.saved?.slice(0, 7)}. The service has not loaded it yet. Your text is
            kept.{" "}
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
            <Button
              variant="outline"
              onClick={() => {
                setComparePath(conflict?.files[0]?.path ?? path);
                setCompare(true);
              }}
            >
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
              ? `${conflict.files
                  .filter(
                    (file) =>
                      file.text !==
                      (file.path === path ? draft.baseText : draft.models?.[file.path]?.baseText),
                  )
                  .map((file) => file.path)
                  .join(
                    ", ",
                  )} changed on ${repository.branch} at ${conflict.head.slice(0, 7)}. Your text is kept.`
              : `${repository.branch} moved while saving, at ${conflict.head.slice(0, 7)}. Your text is kept. Publish again.`}
            <div>
              <Button
                variant="outline"
                onClick={() => {
                  setComparePath(conflict?.files[0]?.path ?? path);
                  setCompare(true);
                }}
              >
                Compare
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  void fetchBlueprintSource(path).then((answer) => {
                    const latestFile = conflict.files.find((file) => file.path === path);
                    const latest = latestFile?.text;
                    if (
                      !latestFile &&
                      (answer.kind !== "ok" || answer.body.commit !== conflict.head)
                    ) {
                      setError("Cannot read the latest blueprint. Your text is kept.");
                      return;
                    }
                    update({
                      base: conflict.head,
                      baseText: latestFile
                        ? (latest ?? "")
                        : answer.kind === "ok"
                          ? answer.body.text
                          : draft.baseText,
                      text: draft.text,
                      models: Object.fromEntries(
                        Object.entries(draft.models ?? {}).map(([name, model]) => {
                          const file = conflict.files.find((file) => file.path === name);
                          return [
                            name,
                            {
                              ...model,
                              baseText: file?.text ?? "",
                              exists: file?.text !== undefined,
                            },
                          ];
                        }),
                      ),
                    });
                    setConflict(undefined);
                  });
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
        <div className="blueprint-view-toggle" aria-label="Editor view">
          <Button variant="ghost" aria-pressed={tab === "canvas"} onClick={() => setTab("canvas")}>
            Canvas
          </Button>
          <Button variant="ghost" aria-pressed={tab === "yaml"} onClick={() => setTab("yaml")}>
            YAML
          </Button>
        </div>
        <div className={`blueprint-panes ${tab === "canvas" ? "canvas-only" : "yaml-only"}`}>
          {tab === "yaml" ? (
            <SourcePane
              path={path}
              text={draft.text}
              baseText={draft.baseText}
              findings={lint.body.findings.filter((f) => !f["file"] || f["file"] === path)}
              warnings={lint.body.warnings.filter((f) => !f["file"] || f["file"] === path)}
              readOnly={pending}
              onChange={change}
              cursor={cursor}
              onCursor={(position) =>
                setSelected(graph ? selectionAtCursor(position, draft.text, graph) : undefined)
              }
            />
          ) : null}
          <div style={{ display: tab === "canvas" ? "contents" : "none" }}>
            <BlueprintCanvasEditor
              text={draft.text}
              baseText={draft.baseText}
              readOnly={pending}
              findings={lint.body.findings.filter((f) => !f["file"] || f["file"] === path)}
              warnings={lint.body.warnings.filter((f) => !f["file"] || f["file"] === path)}
              selection={selected}
              onSelect={setSelected}
              onChange={(basis, text) => {
                if (current.current.text === basis) change(text);
              }}
              onOpenYaml={() => setTab("yaml")}
              blueprintPaths={
                repositoryQuery.data?.kind === "ok"
                  ? repositoryQuery.data.body.blueprints.map((item) => item.path)
                  : []
              }
            />
          </div>
        </div>
        <ProblemsStrip
          findings={lint.body.findings}
          warnings={lint.body.warnings}
          states={lint.body.graph?.states ?? []}
          checking={checking || !lintCurrent}
          failed={lintFailed}
          onRetry={() => setRetry((value) => value + 1)}
          onSelect={selectFinding}
        />
        <PublishDialog
          open={publish}
          path={path}
          added={source.source === "bundled"}
          files={files}
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
                setLint({
                  text: answer.body.text,
                  body: answer.body,
                  models: "{}",
                  base: answer.body.commit ?? "",
                });
              }
            });
          }}
        />
        {openModel ? (
          <Suspense fallback={<p role="status">Loading decision model editor…</p>}>
            <DecisionModelDialog
              path={openModel.path}
              source={openModel.source}
              base={draft.base}
              models={draft.models ?? {}}
              readOnly={pending}
              initialCursor={openModel.cursor}
              onClose={() => setOpenModel(undefined)}
              onApply={(text) => {
                update(
                  applyModelDraft(current.current, openModel.path, {
                    ...openModel.source,
                    text,
                  }),
                );
                setOpenModel(undefined);
              }}
            />
          </Suspense>
        ) : null}
        <CompareDialog
          open={compare}
          files={
            conflict?.files.map((file) => file.path) ?? [path, ...Object.keys(draft.models ?? {})]
          }
          selected={comparePath}
          onSelect={setComparePath}
          latest={
            conflict?.files.find((file) => file.path === comparePath)?.text ??
            (comparePath === path ? source.text : (latestModels[comparePath]?.text ?? ""))
          }
          text={comparePath === path ? draft.text : (draft.models?.[comparePath]?.text ?? "")}
          onChange={(text) => {
            if (comparePath === path) change(text);
            else {
              const model = current.current.models?.[comparePath];
              if (model)
                update(
                  applyModelDraft(current.current, comparePath, {
                    ...model,
                    text,
                  }),
                );
            }
          }}
          onClose={() => setCompare(false)}
        />
      </div>
    </ModelDraftContext>
  );
}
