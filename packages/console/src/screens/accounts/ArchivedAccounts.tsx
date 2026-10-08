// ---
// relationships:
//   implements: operator-console
// ---
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Button } from "../../ui/button.tsx";
import { useAccountSave } from "./useAccountSave.ts";
import { SaveFeedback } from "./SaveFeedback.tsx";
import { ProblemsList } from "../portfolio/ProblemsList.tsx";
import type { AccountRow } from "./rows.ts";
function RestoreAccount({
  row,
  source,
  onSaved,
  onClose,
}: {
  row: AccountRow;
  source: { commit: string; text: string };
  onSaved: (toast: string) => void;
  onClose: () => void;
}) {
  const state = useAccountSave(
    source,
    { kind: "restore", name: row.name },
    `Restore account ${row.name}`,
    onSaved,
    true,
  );
  const sent = useRef<string | undefined>(undefined);
  const key = JSON.stringify([state.base, state.text]);
  const save = useEffectEvent(() => state.save());
  const ready = state.ready;
  useEffect(() => {
    if (ready && sent.current !== key) {
      sent.current = key;
      void save();
    }
  }, [ready, key]);
  return (
    <div>
      <ProblemsList lint={state.lint} />
      <SaveFeedback state={state} onClose={onClose} />
      <Button variant="ghost" disabled={state.busy} onClick={onClose}>
        Cancel restore
      </Button>
    </div>
  );
}
export function ArchivedAccounts({
  rows,
  source,
  onSaved,
}: {
  rows: readonly AccountRow[];
  source: { commit: string; text: string };
  onSaved: (toast: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [restore, setRestore] = useState<AccountRow>();
  if (!rows.length) return null;
  return (
    <div className="accounts-archived">
      <Button variant="ghost" onClick={() => setOpen(!open)}>
        Show archived ({rows.length})
      </Button>
      {restore ? (
        <RestoreAccount
          key={restore.name}
          row={restore}
          source={source}
          onClose={() => setRestore(undefined)}
          onSaved={(toast) => {
            setRestore(undefined);
            onSaved(toast);
          }}
        />
      ) : null}
      {open
        ? rows.map((row) => (
            <div className="accounts-archived-row" key={row.name}>
              <span className="mono">{row.name}</span>
              <span className="muted">{row.kind === "api" ? "API budget" : "Subscription"}</span>
              <Button variant="outline" disabled={!!restore} onClick={() => setRestore(row)}>
                Restore
              </Button>
            </div>
          ))
        : null}
    </div>
  );
}
