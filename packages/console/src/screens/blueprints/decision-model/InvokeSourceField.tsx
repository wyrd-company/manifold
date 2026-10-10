// ---
// relationships:
//   implements: operator-console
// ---
import { useState, useContext } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDecisionModel } from "../../../api/declarations.ts";
import { ModelDraftContext } from "./ModelDraftContext.tsx";
import { modelSummary } from "./decision-model-summary.ts";
import type { InspectorProblem } from "../ValueField.tsx";
import { Combobox } from "@base-ui/react/combobox";
export function InvokeSourceField({
  value,
  disabled,
  groups,
  findings,
  onChange,
}: {
  value: string;
  disabled: boolean;
  groups: readonly { label: string; items: readonly string[] }[];
  findings: readonly InspectorProblem[];
  onChange(value: string): void;
}) {
  const [draft, setDraft] = useState({ source: value, text: value });
  const text = draft.source === value ? draft.text : value;
  const items = groups.flatMap((group) => group.items);
  return (
    <label className={`inspector-field${findings.length ? " has-finding" : ""}`}>
      Implementation
      <Combobox.Root
        items={items}
        filter={null}
        value={value}
        inputValue={text}
        onInputValueChange={(text) => setDraft({ source: value, text })}
        onValueChange={(next) => {
          if (next !== null) onChange(next);
        }}
        disabled={disabled}
      >
        <div className="invoke-source-input">
          <Combobox.Input
            aria-label="Implementation"
            aria-invalid={findings.some((f) => f.severity !== "warning")}
            title={findings.map((f) => f.message).join("\n")}
            className="mono"
            onBlur={() => {
              if (text !== value) onChange(text);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setDraft({ source: value, text: value });
            }}
          />
          <Combobox.Trigger aria-label="Choose implementation">⌄</Combobox.Trigger>
        </div>
        <Combobox.Portal>
          <Combobox.Positioner className="invoke-source-menu" sideOffset={4}>
            <Combobox.Popup>
              <Combobox.List>
                {groups.map((group) => (
                  <Combobox.Group key={group.label}>
                    <Combobox.GroupLabel>{group.label}</Combobox.GroupLabel>
                    {group.items
                      .filter(
                        (item) => text === value || item.toLowerCase().includes(text.toLowerCase()),
                      )
                      .map((item) => (
                        <Combobox.Item key={item} value={item} className="mono">
                          <span>{item}</span>
                          {group.label === "Decide" ? <ModelOptionDescription path={item} /> : null}
                        </Combobox.Item>
                      ))}
                  </Combobox.Group>
                ))}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </label>
  );
}

function ModelOptionDescription({ path }: { path: string }) {
  const context = useContext(ModelDraftContext);
  const source = useQuery({
    queryKey: ["decision-model", path, context?.base],
    queryFn: () => fetchDecisionModel(path, context!.base),
    enabled: !!context?.base,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const text =
    context?.models[path]?.text ?? (source.data?.kind === "ok" ? source.data.body.text : undefined);
  const summary = text === undefined ? undefined : modelSummary(text);
  if (!summary) return null;
  const table = summary.tables[0];
  return (
    <small className="muted">
      {table
        ? `${table.rules} rules · ${table.hitPolicy} · ${table.inputs.join(", ")}`
        : `${summary.nodes} nodes · no decision table`}
    </small>
  );
}
