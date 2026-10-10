// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { lintDeclarationText, saveDeclaration } from "../../api/declarations.ts";
import type {
  DeclarationFindings,
  SaveConflictResponse,
  SaveDeclarationRequest,
} from "@wyrd-company/manifold-shared/declarations-api";
import { createSaveId } from "../blueprints/draft.ts";
import { applyAccountEdit } from "./edits.ts";
import type { AccountEdit } from "./edits.ts";
export function useAccountSave(
  source: { commit: string; text: string },
  edit: AccountEdit | undefined,
  message: string,
  onSaved: (toast: string) => void,
  immediate = false,
) {
  const client = useQueryClient();
  const [base, setBase] = useState(source);
  const [lint, setLint] = useState<{ text: string; body: DeclarationFindings }>();
  const [lintError, setLintError] = useState<string>();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [conflict, setConflict] = useState<SaveConflictResponse>();
  const attempt = useRef<{ key: string; request: SaveDeclarationRequest } | undefined>(undefined);
  const candidate = edit ? applyAccountEdit(base.text, edit) : undefined;
  const text = candidate?.ok ? candidate.text : undefined;
  const lintRequest = useMemo(
    () => (text === undefined ? undefined : { text, version }),
    [text, version],
  );
  useEffect(() => {
    if (!lintRequest) return;
    const { text } = lintRequest;
    const controller = new AbortController();
    const run = () => {
      void lintDeclarationText("accounts.yml", text, controller.signal).then((result) => {
        if (controller.signal.aborted) return;
        if (result.kind === "ok") {
          setLint({ text, body: result.body });
          setLintError(undefined);
        } else
          setLintError(
            result.kind === "failed" || result.kind === "invalid"
              ? result.message
              : "Cannot check these changes.",
          );
      });
    };
    const timer = immediate ? undefined : setTimeout(run, 300);
    if (immediate) run();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [lintRequest, immediate]);
  const checked = text !== undefined && lint?.text === text;
  const ready = checked && !lint.body.findings.length && text !== base.text && !busy && !saved;
  async function save() {
    if (text === undefined) return;
    const key = JSON.stringify([base.commit, text]);
    if (attempt.current?.key !== key)
      attempt.current = {
        key,
        request: { path: "accounts.yml", base: base.commit, text, message, saveId: createSaveId() },
      };
    setBusy(true);
    setError(undefined);
    const result = await saveDeclaration(attempt.current.request);
    if (result.kind === "ok") {
      if (result.body.loaded)
        onSaved(
          result.body.outcome === "unchanged"
            ? "No change to save"
            : `${result.body.outcome === "already-saved" ? "Already saved" : "Saved"} as ${result.body.commit.slice(0, 7)}`,
        );
      else setSaved(result.body.commit);
    } else if (result.kind === "invalid") setLint({ text, body: result.body });
    else if (result.kind === "conflict") setConflict(result.body);
    else setError(result.message);
    await Promise.all([
      client.invalidateQueries({ queryKey: ["portfolio"] }),
      client.invalidateQueries({ queryKey: ["declaration", "accounts.yml"] }),
    ]);
    setBusy(false);
  }
  function rebase() {
    if (!conflict) return;
    setBase({ commit: conflict.head, text: conflict.text ?? "" });
    setLint(undefined);
    setVersion((n) => n + 1);
    setConflict(undefined);
    setSaved(undefined);
    setError(undefined);
    setLintError(undefined);
  }
  return {
    name: edit?.name,
    base: base.commit,
    candidate,
    text,
    lint: lint?.body,
    checked,
    ready,
    busy,
    error,
    saved,
    conflict,
    rebase,
    save,
    lintError,
    retryLint: () => {
      setLintError(undefined);
      setVersion((n) => n + 1);
    },
  };
}
