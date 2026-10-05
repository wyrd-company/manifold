// ---
// relationships:
//   implements: [operator-console, portfolio-api]
// ---
import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Plus } from "lucide-react";
import { fetchPortfolio } from "../../api/portfolio.ts";
import {
  fetchDeclarationSource,
  lintDeclarationText,
  saveDeclaration,
} from "../../api/portfolio-declarations-stand-in.ts";
import type {
  DeclarationLint,
  DeclarationConflict,
} from "../../api/portfolio-declarations-stand-in.ts";
import type { PortfolioItem } from "@wyrd-company/manifold-shared/portfolio-api";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { PublishDialog } from "../blueprints/PublishDialog.tsx";
import { createSaveId } from "../blueprints/draft.ts";
import {
  readPortfolioDraft,
  writePortfolioDraft,
  appendEdit,
  rebaseDraft,
  settlePortfolioDraft,
} from "./draft.ts";
import type { PortfolioDraft } from "./draft.ts";
import { applyEdits } from "./edits.ts";
import type { PortfolioEdit } from "./edits.ts";
import { BudgetSourceCards } from "./BudgetSourceCards.tsx";
import { PortfolioTable } from "./PortfolioTable.tsx";
import { ProblemsList } from "./ProblemsList.tsx";
import { StatusBar } from "./StatusBar.tsx";
import { ArchivedList } from "./ArchivedList.tsx";
import { EditItemDialog } from "./EditItemDialog.tsx";
import { draftRead } from "./preview.ts";
function expandedItems() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem("manifold.portfolio.expanded") ?? "[]");
    return Array.isArray(value) && value.every((i) => typeof i === "string")
      ? (value as string[])
      : [];
  } catch {
    return [];
  }
}
export function PortfolioContent() {
  const client = useQueryClient(),
    query = useQuery({
      queryKey: ["portfolio"],
      queryFn: fetchPortfolio,
      retry: false,
      refetchOnWindowFocus: false,
    }),
    sourceQuery = useQuery({
      queryKey: ["declaration", "portfolio.yml"],
      queryFn: fetchDeclarationSource,
      retry: false,
      refetchOnWindowFocus: false,
    });
  const [draft, setDraft] = useState<PortfolioDraft | undefined>(() =>
      readPortfolioDraft(localStorage),
    ),
    [account, setAccount] = useState(""),
    [expanded, setExpanded] = useState(expandedItems),
    [lint, setLint] = useState<{ text: string; body: DeclarationLint }>(),
    [lintError, setLintError] = useState(false),
    [lintVersion, setLintVersion] = useState(0),
    [publish, setPublish] = useState(false),
    [message, setMessage] = useState("Update portfolio allocations"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>(),
    [conflict, setConflict] = useState<DeclarationConflict>(),
    [toast, setToast] = useState<string>(),
    [dropped, setDropped] = useState<readonly PortfolioEdit[]>([]),
    [dialog, setDialog] = useState<{ item?: PortfolioItem; before: PortfolioDraft | undefined }>(),
    [discard, setDiscard] = useState(false),
    [autoSave, setAutoSave] = useState<string>();
  const source = sourceQuery.data?.kind === "ok" ? sourceQuery.data.body : undefined;
  useEffect(() => {
    writePortfolioDraft(localStorage, draft);
  }, [draft]);
  const draftText = draft?.text,
    savedCommit = draft?.saved;
  const applyLint = useEffectEvent(
    (text: string, result: Awaited<ReturnType<typeof lintDeclarationText>>) => {
      if (draft?.text !== text) return;
      if (result.kind === "ok") {
        setLint({ text, body: result.body });
        setLintError(false);
      } else setLintError(true);
    },
  );
  const lintRequest = useMemo(
    () => (draftText === undefined ? undefined : { text: draftText, version: lintVersion }),
    [draftText, lintVersion],
  );
  useEffect(() => {
    if (!lintRequest || savedCommit) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void lintDeclarationText("portfolio.yml", lintRequest.text, controller.signal).then(
        (result) => {
          if (!controller.signal.aborted) applyLint(lintRequest.text, result);
        },
      );
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lintRequest, savedCommit]);
  const pending = !!draft && !draft.saved && lint?.text !== draft.text && !lintError;
  async function refresh() {
    await Promise.all([query.refetch(), sourceQuery.refetch()]);
  }
  function startDraft(): PortfolioDraft | undefined {
    return (
      draft ??
      (source
        ? { base: source.commit, baseText: source.text, text: source.text, edits: [] }
        : undefined)
    );
  }
  function edit(e: PortfolioEdit) {
    setLintError(false);
    setDraft((previous) => {
      const initial =
        previous ??
        (source
          ? { base: source.commit, baseText: source.text, text: source.text, edits: [] }
          : undefined);
      return initial ? appendEdit(initial, e) : previous;
    });
    setToast(undefined);
  }
  async function save(commitMessage: string) {
    if (!draft || busy) return;
    const saving = { ...draft, saveId: draft.saveId ?? createSaveId(), message: commitMessage };
    setDraft(saving);
    setBusy(true);
    setError(undefined);
    const result = await saveDeclaration({
      path: "portfolio.yml",
      base: saving.base,
      text: saving.text,
      message: commitMessage,
      saveId: saving.saveId,
    });
    setBusy(false);
    if (result.kind === "ok") {
      const saved = { ...saving, saved: result.body.commit };
      setDraft(saved);
      setToast(
        result.body.outcome === "unchanged"
          ? "No change to save"
          : `${result.body.outcome === "already-saved" ? "Already saved" : "Saved"} as ${result.body.commit.slice(0, 7)}`,
      );
      setPublish(false);
      setDialog(undefined);
      setConflict(undefined);
      await client.invalidateQueries({ queryKey: ["portfolio"] });
      const fresh = await sourceQuery.refetch();
      if (fresh.data?.kind === "ok")
        setDraft(
          settlePortfolioDraft(
            saved,
            { commit: fresh.data.body.commit, text: fresh.data.body.text },
            result.body.loaded,
          ),
        );
    } else if (result.kind === "invalid") {
      setLint({ text: saving.text, body: result.body });
    } else if (result.kind === "conflict") {
      setConflict(result.body);
      setPublish(false);
    } else setError(result.message);
  }
  const read = query.data?.kind === "ok" ? query.data.body : undefined;
  const settleSource = useEffectEvent(() => {
    if (!source) return;
    setDraft((previous) =>
      previous?.saved
        ? settlePortfolioDraft(previous, source, read?.commit === source.commit)
        : previous,
    );
  });
  useEffect(() => {
    if (source) queueMicrotask(() => settleSource());
  }, [source]);
  const selected = read?.accounts.some((a) => a.name === account)
    ? account
    : (read?.accounts[0]?.name ?? "");
  const display = read && draft ? draftRead(read, draft.text) : read;
  const findings = draft ? (lint?.text === draft.text ? lint.body : undefined) : source;
  const canSave =
    !!draft &&
    !draft.saved &&
    draft.text !== draft.baseText &&
    !pending &&
    !lintError &&
    lint?.text === draft.text &&
    !lint.body.findings.length;
  const saveAutomatically = useEffectEvent((commitMessage: string) => {
    setAutoSave(undefined);
    void save(commitMessage);
  });
  useEffect(() => {
    if (autoSave && canSave) queueMicrotask(() => saveAutomatically(autoSave));
  }, [autoSave, canSave]);
  function cancel() {
    if (draft && draft.text !== draft.baseText) setDiscard(true);
    else setDraft(undefined);
  }
  const invalidSource = source?.findings.some(
    (f) => f.file === "portfolio" && (f.kind === "schema" || f.kind === "syntax"),
  );
  return (
    <section className="portfolio-screen">
      <div className="portfolio-title-actions">
        {draft && !dialog ? (
          <>
            <Button variant="outline" disabled={busy} onClick={cancel}>
              Cancel
            </Button>
            <Button
              disabled={!canSave || busy}
              onClick={() => {
                setMessage("Update portfolio allocations");
                setPublish(true);
              }}
            >
              Save allocations
            </Button>
          </>
        ) : !dialog ? (
          <>
            <Button
              variant="outline"
              disabled={!source || invalidSource}
              onClick={() => setDraft(startDraft())}
            >
              Edit allocations
            </Button>
            <Button
              disabled={!source || invalidSource}
              onClick={() => setDialog({ before: draft })}
            >
              <Plus size={14} /> Add item
            </Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh portfolio"
          disabled={query.isFetching}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
      {toast ? (
        <p role="status" className="info-alert">
          {toast}
        </p>
      ) : null}
      {error ? (
        <div role="alert" className="error-alert">
          {error}{" "}
          <Button variant="outline" onClick={() => void save(draft?.message ?? message)}>
            Try again
          </Button>
        </div>
      ) : null}
      {sourceQuery.data?.kind === "failed" ? (
        <div role="alert" className="error-alert">
          {sourceQuery.data.message}
          <Button variant="outline" onClick={() => void sourceQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : null}
      {query.data?.kind === "failed" ? (
        <div role="alert" className="error-alert">
          {query.data.message}
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : !display ? (
        <p role="status">Loading portfolio…</p>
      ) : (
        <>
          {display.accounts.length ? (
            <BudgetSourceCards accounts={display.accounts} />
          ) : (
            <div role="status" className="info-alert">
              No accounts are declared. Declare them in accounts.yml.
            </div>
          )}
          {display.accounts.length > 1 ? (
            <label className="portfolio-account">
              Allocations for{" "}
              <select
                aria-label="Allocations for"
                value={selected}
                onChange={(e) => setAccount(e.target.value)}
              >
                {display.accounts.map((a) => (
                  <option key={a.name}>{a.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {invalidSource ? (
            <div role="alert" className="error-alert">
              portfolio.yml at {source?.commit.slice(0, 7)} cannot be edited here. Fix it in the
              process repository.
            </div>
          ) : null}
          {draft?.saved ? (
            <div role="alert" className="info-alert">
              Saved as {draft.saved.slice(0, 7)}. The service has not loaded it yet. Your changes
              are kept.{" "}
              <Button variant="outline" onClick={() => void save(draft.message ?? message)}>
                Load saved version
              </Button>
            </div>
          ) : null}
          {conflict ? (
            <div role="alert" className="error-alert">
              portfolio.yml changed at {conflict.head.slice(0, 7)}. Your changes are kept.
              <Button
                variant="outline"
                onClick={() => {
                  if (draft) {
                    const result = rebaseDraft(draft, conflict.head, conflict.text ?? "");
                    setDraft(result.draft);
                    setDropped(result.dropped);
                    setConflict(undefined);
                  }
                }}
              >
                Apply my changes to the latest
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(undefined);
                  setConflict(undefined);
                  void refresh();
                }}
              >
                Discard changes
              </Button>
            </div>
          ) : null}
          {dropped.length ? (
            <div role="status" className="info-alert">
              Dropped edits:{" "}
              {dropped.map((e) => `${e.kind} ${"item" in e ? e.item : e.id}`).join(", ")}
            </div>
          ) : null}
          <StatusBar
            read={display}
            account={selected}
            lint={findings}
            pending={pending}
            editing={!!draft}
          />
          <ProblemsList lint={findings ?? { findings: [], warnings: display.warnings }} />
          {lintError ? (
            <div role="alert" className="error-alert">
              Cannot check these changes. Try again.
              <Button variant="outline" onClick={() => setLintVersion((n) => n + 1)}>
                Try again
              </Button>
            </div>
          ) : null}
          <PortfolioTable
            read={display}
            account={selected}
            expanded={expanded}
            onExpand={(id) => {
              const next = expanded.includes(id)
                ? expanded.filter((i) => i !== id)
                : [...expanded, id];
              setExpanded(next);
              localStorage.setItem("manifold.portfolio.expanded", JSON.stringify(next));
            }}
            editing={!!draft && !dialog}
            findings={findings?.findings ?? []}
            onAllocation={(item, field, value) =>
              edit({
                kind: "allocation",
                item,
                account: selected,
                ...(field === "guarantee" ? { guarantee: value ?? 0 } : { ceiling: value }),
              })
            }
            onEdit={(item) => setDialog({ item, before: draft })}
          />
          <ArchivedList
            read={display}
            account={selected}
            editing={!!draft}
            onRestore={(id) => {
              edit({ kind: "restore", item: id });
              setAutoSave(`Restore portfolio item ${id}`);
            }}
          />
          {dialog ? (
            <EditItemDialog
              item={dialog.item}
              read={display}
              account={selected}
              lint={findings}
              pending={pending || (!!draft && lint?.text !== draft.text)}
              busy={busy}
              onEdit={edit}
              onReplaceNew={(edit) => {
                const base =
                  dialog.before ??
                  (source
                    ? { base: source.commit, baseText: source.text, text: source.text, edits: [] }
                    : undefined);
                if (base) setDraft(appendEdit(base, edit));
              }}
              onRemoveNew={(id) =>
                setDraft((previous) => {
                  if (!previous) return previous;
                  const edits = previous.edits.filter((edit) =>
                    "item" in edit ? edit.item !== id : edit.id !== id,
                  );
                  const applied = applyEdits(previous.baseText, edits);
                  return applied.ok
                    ? {
                        base: previous.base,
                        baseText: previous.baseText,
                        text: applied.text,
                        edits,
                      }
                    : previous;
                })
              }
              onArchive={(id) => {
                edit({ kind: "archive", item: id });
                setAutoSave(`Archive portfolio item ${id}`);
              }}

              onSave={(m) => void save(m)}
              onClose={() => {
                setDraft(dialog.before);
                setDialog(undefined);
              }}
            />
          ) : null}
        </>
      )}
      <Dialog open={discard} onOpenChange={setDiscard}>
        <DialogPopup style={{ width: 400 }}>
          <DialogTitle>Discard changes to portfolio.yml?</DialogTitle>
          <DialogDescription>{draft?.edits.length ?? 0} edits will be discarded.</DialogDescription>
          <div className="blueprint-dialog-actions">
            <Button variant="outline" onClick={() => setDiscard(false)}>
              Keep editing
            </Button>
            <Button
              onClick={() => {
                setDraft(undefined);
                setDiscard(false);
              }}
            >
              Discard changes
            </Button>
          </div>
        </DialogPopup>
      </Dialog>
      <PublishDialog
        open={publish}
        title="Save allocations"
        path="portfolio.yml"
        added={!source?.exists}
        repository={{ url: "Process repository", branch: "configured branch" }}
        message={message}
        onMessage={setMessage}
        busy={busy}
        error={error}
        onClose={() => setPublish(false)}
        onPublish={() => void save(message)}
      />
    </section>
  );
}
