// ---
// relationships:
//   implements: operator-console
// ---
import { useState } from "react";
import type { UsageProvider } from "@wyrd-company/manifold-shared";
import { Dialog, DialogPopup, DialogTitle, DialogDescription } from "../../ui/dialog.tsx";
import { Button } from "../../ui/button.tsx";
import { ProblemsList } from "../portfolio/ProblemsList.tsx";
import { formFor, editFor, localDateTime } from "./form.ts";
import type { AccountForm } from "./form.ts";
import { usedBy } from "./rows.ts";
import type { AccountRow } from "./rows.ts";
import { findingField } from "./findings.ts";
import { useAccountSave } from "./useAccountSave.ts";
import { SaveFeedback } from "./SaveFeedback.tsx";
import { ArchiveDialog } from "./ArchiveDialog.tsx";
export function AccountDialog({
  row,
  rows,
  environments,
  source,
  onClose,
  onSaved,
}: {
  row?: AccountRow;
  rows: readonly AccountRow[];
  environments: readonly string[];
  source: { commit: string; text: string };
  onClose: () => void;
  onSaved: (toast: string) => void;
}) {
  const [form, setForm] = useState(() => formFor(row, new Date()));
  const [archive, setArchive] = useState(false);
  const edit = editFor(form, row);
  const state = useAccountSave(
    source,
    "invalid" in edit ? undefined : edit,
    `${row ? "Update" : "Add"} account ${form.name}`,
    onSaved,
  );
  const mixed = (row?.providers.length ?? 0) > 1;
  const names = [...new Set([...environments, ...form.usage.map((entry) => entry.environment)])];
  const entries = form.usage.flatMap((entry) =>
    entry.instances.map((instance) => ({
      environment: entry.environment,
      instance,
      provider: form.provider,
    })),
  );
  const collisions = mixed
    ? []
    : entries.map((entry) =>
        usedBy(rows, {
          environment: entry.environment,
          provider: entry.provider,
          account: form.name,
          ...(entry.instance ? { instance: entry.instance } : {}),
        }),
      );
  const set = <K extends keyof AccountForm>(key: K, value: AccountForm[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const marks = state.lint?.findings ?? [];
  function mark(field: string) {
    return marks
      .filter((finding) => findingField(finding, form.name) === field)
      .map((finding) => finding.message)
      .join(" ");
  }
  function invalid(field: string) {
    return "invalid" in edit && edit.invalid === field ? `Enter a valid ${field}.` : mark(field);
  }
  function instances(environment: string, values: readonly string[]) {
    set(
      "usage",
      form.usage.map((entry) =>
        entry.environment === environment ? { environment, instances: values } : entry,
      ),
    );
  }
  const localReset = new Date(
    row && form.reset === localDateTime(new Date(row.capacity.reset))
      ? row.capacity.reset
      : form.reset,
  );
  const utc = Number.isFinite(localReset.getTime()) ? localReset.toISOString() : "";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !state.busy) onClose();
      }}
    >
      <DialogPopup style={{ width: 520 }} showCloseButton={!state.busy}>
        <DialogTitle>{row ? `Edit ${row.name}` : "Add account"}</DialogTitle>
        <DialogDescription>Edit the account and its budget in accounts.yml.</DialogDescription>
        <fieldset className="account-fields" disabled={state.busy || !!state.saved}>
          <div>
            <span className="field-label">Kind</span>
            <div className="account-kind" role="group" aria-label="Kind">
              {(["api", "subscription"] as const).map((kind) => (
                <Button
                  key={kind}
                  variant={form.kind === kind ? "default" : "outline"}
                  aria-pressed={form.kind === kind}
                  disabled={!!row}
                  onClick={() => set("kind", kind)}
                >
                  {kind === "api" ? "API budget" : "Subscription"}
                </Button>
              ))}
            </div>
          </div>
          <label>
            Name
            <input
              aria-label="Name"
              value={form.name}
              disabled={!!row}
              aria-invalid={
                !!mark("name") ||
                (state.candidate?.ok === false && state.candidate.reason === "name-taken")
              }
              onChange={(e) => set("name", e.target.value)}
            />
            <small className="muted">Lowercase letters, digits, and dashes</small>
            <small className="error-text">
              {mark("name") ||
                (state.candidate?.ok === false && state.candidate.reason === "name-taken"
                  ? `An account named ${form.name} exists.`
                  : "")}
            </small>
          </label>
          <label>
            Provider
            <select
              aria-label="Provider"
              value={form.provider}
              disabled={mixed}
              onChange={(e) => set("provider", e.target.value as UsageProvider)}
            >
              {["claude", "codex", "cursor", "grok", "opencode"].map((provider) => (
                <option key={provider}>{provider}</option>
              ))}
            </select>
          </label>
          <div>
            <span className="field-label">Used by</span>
            {mixed ? (
              <>
                <ul>
                  {row?.usage.map((entry) => (
                    <li key={JSON.stringify(entry)} className="mono">
                      {entry.environment} · {entry.provider}
                      {entry.instance ? ` · ${entry.instance}` : ""}
                    </li>
                  ))}
                </ul>
                <small className="muted">Edit its usage in accounts.yml.</small>
              </>
            ) : (
              names.map((environment) => {
                const group = form.usage.find((entry) => entry.environment === environment);
                const occupied = usedBy(rows, {
                  account: form.name,
                  environment,
                  provider: form.provider,
                });
                let offset = 0;
                for (const entry of form.usage) {
                  if (entry.environment === environment) break;
                  offset += entry.instances.length;
                }
                return (
                  <div key={environment} className="account-environment">
                    <label className="account-checkbox">
                      <input
                        type="checkbox"
                        aria-label={environment}
                        checked={!!group}
                        onChange={(e) =>
                          set(
                            "usage",
                            e.target.checked
                              ? [...form.usage, { environment, instances: [""] }]
                              : form.usage.filter((entry) => entry.environment !== environment),
                          )
                        }
                      />
                      <span className="mono">{environment}</span>
                      {!environments.includes(environment) ? (
                        <small className="muted">Not configured</small>
                      ) : null}
                      {!group && occupied ? (
                        <small className="muted">Used by {occupied}</small>
                      ) : null}
                    </label>
                    {group ? (
                      <div className="account-instances">
                        {group.instances.map((instance, i) => (
                          // oxlint-disable-next-line react/no-array-index-key -- Positions preserve focus while the instance text changes.
                          <div key={i}>
                            <label>
                              Instance
                              <input
                                className="mono"
                                aria-label={`${environment} instance ${i + 1}`}
                                value={instance}
                                aria-invalid={
                                  !!collisions[offset + i] || !!mark(`usage:${offset + i}`)
                                }
                                onChange={(e) =>
                                  instances(
                                    environment,
                                    group.instances.map((value, index) =>
                                      index === i ? e.target.value : value,
                                    ),
                                  )
                                }
                              />
                            </label>
                            {group.instances.length > 1 ? (
                              <Button
                                variant="ghost"
                                aria-label={`Remove ${environment} instance ${i + 1}`}
                                onClick={() =>
                                  instances(
                                    environment,
                                    group.instances.filter((_, index) => index !== i),
                                  )
                                }
                              >
                                Remove
                              </Button>
                            ) : null}
                            <small className="error-text">
                              {collisions[offset + i]
                                ? `Used by ${collisions[offset + i]}`
                                : mark(`usage:${offset + i}`)}
                            </small>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          onClick={() => instances(environment, [...group.instances, ""])}
                        >
                          Add instance
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          <label>
            {form.kind === "api" ? "Budget per window" : "Usage limit per window"}
            <div className="account-dollars">
              <span>$</span>
              <input
                aria-label={form.kind === "api" ? "Budget per window" : "Usage limit per window"}
                type="number"
                min="0.000001"
                step="0.01"
                value={form.amount}
                aria-invalid={!!invalid("amount")}
                onChange={(e) => set("amount", e.target.value)}
              />
            </div>
            <small className="error-text">{invalid("amount")}</small>
          </label>
          <label>
            Window
            <select
              aria-label="Window"
              value={"preset" in form.window ? form.window.preset : "custom"}
              onChange={(e) =>
                set(
                  "window",
                  e.target.value === "custom"
                    ? { count: "1", unit: "hours" }
                    : { preset: e.target.value as "monthly" | "weekly" | "daily" },
                )
              }
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
              <option value="custom">Custom</option>
            </select>
            <small className="error-text">{invalid("window")}</small>
          </label>
          {!("preset" in form.window) ? (
            <div className="account-custom-window">
              <label>
                Count
                <input
                  aria-label="Window count"
                  type="number"
                  step="1"
                  value={form.window.count}
                  onChange={(e) => {
                    if (!("preset" in form.window))
                      set("window", { ...form.window, count: e.target.value });
                  }}
                />
              </label>
              <label>
                Unit
                <select
                  aria-label="Window unit"
                  value={form.window.unit}
                  onChange={(e) => {
                    if (!("preset" in form.window))
                      set("window", {
                        ...form.window,
                        unit: e.target.value as "hours" | "days" | "months",
                      });
                  }}
                >
                  {["hours", "days", "months"].map((unit) => (
                    <option key={unit}>{unit}</option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <label>
            {form.kind === "api" ? "Resets on" : "Resets at"}
            <input
              aria-label={form.kind === "api" ? "Resets on" : "Resets at"}
              type="datetime-local"
              step="any"
              value={form.reset}
              aria-invalid={!!invalid("reset")}
              onChange={(e) => set("reset", e.target.value)}
            />
            <small className="mono muted">{utc}</small>
            <small className="error-text">{invalid("reset")}</small>
          </label>
        </fieldset>
        <ProblemsList
          lint={
            state.lint
              ? {
                  ...state.lint,
                  findings: state.lint.findings.filter(
                    (finding) => !findingField(finding, form.name),
                  ),
                }
              : undefined
          }
        />
        <SaveFeedback state={state} onClose={onClose} />
        <div className="blueprint-dialog-actions">
          {row ? (
            <Button
              variant="outline"
              className="error-text account-archive"
              disabled={state.busy || !!state.saved}
              onClick={() => setArchive(true)}
            >
              Archive account
            </Button>
          ) : null}
          <Button variant="outline" disabled={state.busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!state.ready || collisions.some(Boolean) || "invalid" in edit}
            onClick={() => void state.save()}
          >
            Save
          </Button>
        </div>
        {archive && row ? (
          <ArchiveDialog
            name={row.name}
            source={source}
            onClose={() => setArchive(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}
