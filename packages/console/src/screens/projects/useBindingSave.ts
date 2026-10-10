// ---
// relationships:
//   implements: operator-console
// ---
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  BindingsResponse,
  BindingEdit,
  BindingSaveRequest,
  DeclarationFinding,
} from "@wyrd-company/manifold-shared/declarations-api";
import { saveBinding, fetchBindings } from "../../api/declarations.ts";
import { createSaveId } from "../blueprints/draft.ts";
export function useBindingSave(bindings: BindingsResponse, onSaved: (loaded: boolean) => void) {
  const client = useQueryClient();
  const [base, setBase] = useState(bindings.commit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<string>();
  const [findings, setFindings] = useState<readonly DeclarationFinding[]>([]);
  const attempt = useRef<{ key: string; request: BindingSaveRequest } | undefined>(undefined);
  async function send(edit: BindingEdit, message: string) {
    const key = JSON.stringify({ edit, message, base });
    if (attempt.current?.key !== key)
      attempt.current = { key, request: { edit, message, base, saveId: createSaveId() } };
    setBusy(true);
    setError(undefined);
    setFindings([]);
    const result = await saveBinding(attempt.current.request);
    if (result.kind === "ok") {
      if (result.body.loaded) onSaved(true);
      else setSaved(result.body.commit);
    } else if (result.kind === "invalid") setFindings(result.body.findings);
    else if (result.kind === "conflict") {
      setError(
        `bindings.yml changed on ${bindings.repository.branch} at ${result.body.head.slice(0, 7)}. Your values are kept.`,
      );
      const latest = await fetchBindings();
      if (latest.kind === "ok") {
        setBase(latest.body.commit);
        client.setQueryData(["bindings"], latest);
      }
    } else setError(result.message);
    await Promise.all(
      ["bindings", "projects", "tasks"].map((key) => client.invalidateQueries({ queryKey: [key] })),
    );
    setBusy(false);
  }
  return { busy, error, saved, findings, send };
}
