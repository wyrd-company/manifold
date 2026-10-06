// ---
// relationships:
//   implements: operator-console
// ---
import { transitionField } from "./editor-selection.ts";
import { useState, useEffect, useRef } from "react";
import { parse, stringify } from "yaml";
import { manifoldImplementationCatalog } from "@wyrd-company/manifold-shared/implementation-catalog";
import type { BlueprintGraph } from "@wyrd-company/manifold-shared/blueprints-api";
import { findingField } from "./problems.ts";
import { inspectorModel } from "./inspector-model.ts";
import { atPointer, pointerKey, statePointer, shortestTarget } from "./blueprint-edits.ts";
import type { BlueprintEdit } from "./blueprint-edits.ts";
import type { InspectorProblem } from "./ValueField.tsx";
import { ValueField } from "./ValueField.tsx";
import { Button } from "../../ui/button.tsx";
const noPaths: readonly string[] = [];
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
function TextField({
  label,
  value,
  disabled,
  onChange,
  options,
}: {
  label: string;
  value: unknown;
  disabled: boolean;
  onChange: (value: string) => void;
  options?: readonly string[];
}) {
  const source = String(value ?? "");
  const [draft, setDraft] = useState({ source, text: source });
  const text = draft.source === source ? draft.text : source;
  const setText = (next: string) => setDraft({ source, text: next });
  const commit = () => {
    if (text !== String(value ?? "")) onChange(text);
  };
  return (
    <label className="inspector-field">
      {label}
      <input
        aria-label={label}
        className="mono"
        disabled={disabled}
        value={text}
        autoFocus={label === "Key"}
        list={options ? "options-" + label : undefined}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
          if (event.key === "Escape") setText(String(value ?? ""));
        }}
      />
      {options ? (
        <datalist id={"options-" + label}>
          {options.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}
export function Inspector({
  text,
  selection,
  graph,
  findings,
  disabled,
  onEdit,
  onSelect,
  onClose,
  onAddTransition,
  blueprintPaths = noPaths,
}: {
  text: string;
  selection?: string | undefined;
  graph: BlueprintGraph;
  findings: readonly InspectorProblem[];
  disabled: boolean;
  onEdit: (edit: BlueprintEdit) => void;
  onSelect: (selection: string | undefined) => void;
  onClose: () => void;
  onAddTransition?: (source: string) => void;
  blueprintPaths?: readonly string[];
}) {
  const host = useRef<HTMLElement>(null);
  const document: unknown = parse(text);
  const [schemaName, setSchemaName] = useState("");
  const initial = selection?.startsWith("@initial:");
  const edge = selection?.startsWith("/") ? selection : undefined;
  const path = initial ? selection!.slice(9) : selection && !edge ? selection : "";
  const pointer = edge ?? statePointer(path);
  const raw = atPointer(document, pointer);
  const value = typeof raw === "string" && edge ? { target: raw } : obj(raw);
  const type = edge
    ? "transition"
    : path
      ? String(value["type"] ?? (value["states"] ? "compound" : "atomic"))
      : "root";
  const [more, setMore] = useState<string[]>([]);
  const set = (at: string, next: unknown) => {
    if (edge && typeof raw === "string")
      onEdit({
        kind: "set",
        pointer,
        value: { target: raw, [at.slice(pointer.length + 1)]: next },
      });
    else onEdit({ kind: "set", pointer: at, value: next });
  };
  const fieldFindings = (at: string) =>
    findings.filter((f) => f.location === at || f.location.startsWith(at + "/"));
  const addSchema = (kind: "actors" | "events", name: string, schema: unknown) => {
    const schemas = obj(atPointer(document, "/schemas"));
    set("/schemas", { ...schemas, [kind]: { ...obj(schemas[kind]), [name]: schema } });
  };
  const candidate = edge ? transitionField(document, edge) : undefined;
  const allFields = inspectorModel(type, value, pointer);
  const focusLocation = findings.find(
    (f) => f.location === pointer || f.location.startsWith(pointer + "/"),
  )?.location;
  const focusField = focusLocation
    ? findingField(
        { location: focusLocation } as InspectorProblem,
        allFields.flatMap((group) => group.fields.map((field) => field.pointer)),
      )
    : undefined;
  useEffect(() => {
    if (focusField && !host.current?.contains(window.document.activeElement))
      host.current
        ?.querySelector(`[data-pointer="${CSS.escape(focusField)}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [focusField, host]);
  const hidden = (key: string) =>
    !(key in value) &&
    !more.includes(key) &&
    ((["atomic", "final", "history"].includes(type) && ["initial", "onDone"].includes(key)) ||
      (type === "history" && ["entry", "exit", "invoke", "output"].includes(key)) ||
      (type !== "history" && ["history"].includes(key)) ||
      (type !== "final" && type !== "root" && key === "output"));
  const renderTargets = (targets: unknown, at: string) => {
    const rows = targets === undefined ? [] : Array.isArray(targets) ? targets : [targets];
    const source = graph.transitions.find((row) => row.location === pointer)?.source ?? path;
    return (
      <div>
        {rows
          .map((target, index) => ({ target, index, location: at + "/" + index }))
          .map(({ target, index, location }) => (
            <label className="inspector-field" key={location}>
              Target
              <select
                aria-label={"Target " + (index + 1)}
                disabled={disabled}
                value={String(target)}
                onChange={(event) => {
                  const next = [...rows];
                  next[index] = event.target.value;
                  set(at, next.length === 1 ? next[0] : next);
                }}
              >
                <option value={String(target)}>{String(target)}</option>
                {graph.states.map((state) => {
                  const reference = shortestTarget(
                    source,
                    state.path,
                    String(atPointer(document, "/machine/id") ?? "(machine)"),
                  );
                  return (
                    <option key={state.path} value={reference}>
                      {state.path}
                    </option>
                  );
                })}
              </select>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() => {
                  const next = rows.filter((_, i) => i !== index);
                  if (next.length) set(at, next.length === 1 ? next[0] : next);
                  else if (typeof raw === "string" && edge)
                    onEdit({ kind: "set", pointer, value: {} });
                  else onEdit({ kind: "remove", pointer: at });
                }}
              >
                No target
              </Button>
            </label>
          ))}
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() =>
            set(at, [
              ...rows,
              shortestTarget(
                source,
                graph.states[0]?.path ?? "",
                String(atPointer(document, "/machine/id") ?? "(machine)"),
              ),
            ])
          }
        >
          Add target
        </Button>
      </div>
    );
  };
  const renderGate = (meta: unknown, at: string) => {
    const gate = obj(obj(meta)["gate"]);
    const point = at + "/gate";
    return (
      <div>
        {obj(meta)["gate"] ? (
          <>
            <TextField
              label="Comparator"
              value={gate["comparator"]}
              disabled={disabled}
              onChange={(next) => set(point + "/comparator", next)}
            />
            <TextField
              label="Return point"
              value={
                typeof gate["return"] === "string" ? gate["return"] : obj(gate["return"])["state"]
              }
              options={["exit", ...graph.states.map((state) => state.path)]}
              disabled={disabled}
              onChange={(next) =>
                set(point + "/return", next === "exit" ? "exit" : { state: next })
              }
            />
            <label>
              <input
                type="checkbox"
                disabled={disabled}
                checked={Boolean(gate["reservation"])}
                onChange={(event) => set(point + "/reservation", event.target.checked)}
              />{" "}
              Reservation
            </label>
            <TextField
              label="Token event"
              value={gate["token"] ?? "token"}
              disabled={disabled}
              onChange={(next) => set(point + "/token", next)}
            />
            <TextField
              label="Dependencies region"
              value={gate["dependencies"]}
              options={graph.states.map((state) => state.path)}
              disabled={disabled}
              onChange={(next) => set(point + "/dependencies", next)}
            />
            <Button
              variant="ghost"
              disabled={disabled}
              onClick={() => onEdit({ kind: "remove", pointer: point })}
            >
              Remove gate
            </Button>
          </>
        ) : type !== "root" ? (
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() =>
              set(at, { ...obj(meta), gate: { comparator: "compare.ts", return: "exit" } })
            }
          >
            Add gate
          </Button>
        ) : null}
        <ValueField
          label="Meta"
          value={meta}
          disabled={disabled}
          findings={fieldFindings(at)}
          onChange={(next) => set(at, next)}
        />
      </div>
    );
  };
  const renderMapping = (value: unknown, at: string, label: string) => (
    <div>
      <select
        aria-label={label + " kind"}
        disabled={disabled}
        value={obj(value)["type"] === "expression.map" ? "expression" : "static"}
        onChange={(event) =>
          set(
            at,
            event.target.value === "expression"
              ? { type: "expression.map", params: { expression: "input" } }
              : {},
          )
        }
      >
        <option value="static">Static YAML</option>
        <option value="expression">Expression</option>
      </select>
      {obj(value)["type"] === "expression.map" ? (
        <ValueField
          label={label + " expression"}
          expression
          disabled={disabled}
          value={obj(obj(value)["params"])["expression"]}
          findings={fieldFindings(at)}
          onChange={(next) => set(at + "/params/expression", next)}
        />
      ) : (
        <ValueField
          label={label}
          value={value}
          disabled={disabled}
          findings={fieldFindings(at)}
          onChange={(next) => set(at, next)}
        />
      )}
    </div>
  );
  const renderReference = (reference: unknown, at: string, kind: "action" | "guard") => {
    const referenceValue = typeof reference === "string" ? { type: reference } : obj(reference);
    const name = String(referenceValue["type"] ?? "");
    const entry = manifoldImplementationCatalog.find((item) => item.name === name);
    return (
      <div className="inspector-reference" key={at}>
        <TextField
          label={kind === "guard" ? "Guard implementation" : "Action implementation"}
          value={name}
          disabled={disabled}
          options={manifoldImplementationCatalog
            .filter((item) => item.kind === kind)
            .map((item) => item.name)}
          onChange={(next) => set(at, { ...referenceValue, type: next })}
        />
        <small className="muted">{entry?.description ?? "Unknown implementation"}</small>
        {name.startsWith("expression.") ? (
          <ValueField
            label="Expression"
            expression
            value={obj(referenceValue["params"])["expression"]}
            disabled={disabled}
            findings={fieldFindings(at)}
            onChange={(next) =>
              set(at, {
                ...referenceValue,
                params: { ...obj(referenceValue["params"]), expression: next },
              })
            }
          />
        ) : (
          <ValueField
            label="Parameters"
            value={referenceValue["params"]}
            disabled={disabled}
            findings={fieldFindings(at + "/params")}
            onChange={(next) => set(at, { ...referenceValue, params: next })}
          />
        )}
      </div>
    );
  };
  const renderActions = (actions: unknown, at: string) => {
    const rows = actions === undefined ? [] : Array.isArray(actions) ? actions : [actions];
    return (
      <div>
        {rows.map((row, i) => {
          const location = at + "/" + i;
          return (
            <div key={location}>
              {renderReference(row, at + (Array.isArray(actions) ? "/" + i : ""), "action")}
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  set(
                    at,
                    rows.filter((_, index) => index !== i),
                  )
                }
              >
                Remove action
              </Button>
            </div>
          );
        })}
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() =>
            set(at, [...rows, { type: "expression.assign", params: { expression: "context" } }])
          }
        >
          Add action
        </Button>
      </div>
    );
  };
  const renderInvoke = (invokes: unknown, at: string) => {
    const rows = invokes === undefined ? [] : Array.isArray(invokes) ? invokes : [invokes];
    return (
      <div>
        {rows.map((row, i) => {
          const invocation = obj(row);
          const src = String(invocation["src"] ?? "");
          const entry = manifoldImplementationCatalog.find(
            (item) => item.name === src && item.kind === "actor",
          );
          const location = at + (Array.isArray(invokes) ? "/" + i : "");
          const contract = atPointer(document, "/schemas/actors/" + pointerKey(src));
          return (
            <div className="invoke-card" key={location}>
              <TextField
                label="Implementation"
                value={src}
                disabled={disabled}
                options={[
                  ...manifoldImplementationCatalog
                    .filter((item) => item.kind === "actor")
                    .map((item) => item.name),
                  ...blueprintPaths,
                ]}
                onChange={(next) => set(location + "/src", next)}
              />
              <small className="muted">
                {entry?.description ??
                  (blueprintPaths.includes(src)
                    ? src
                    : src.startsWith("blueprints/")
                      ? "Not in the process repository"
                      : "Unknown implementation")}
              </small>
              {["id", "systemId"].map((key) => (
                <TextField
                  key={key + String(invocation[key])}
                  label={key === "id" ? "Invoke id" : "System id"}
                  value={invocation[key]}
                  disabled={disabled}
                  onChange={(next) => set(location + "/" + key, next)}
                />
              ))}
              {renderMapping(invocation["input"], location + "/input", "Input")}
              {["onDone", "onError", "onSnapshot"].map((key) => (
                <ValueField
                  key={key}
                  label={key}
                  value={invocation[key]}
                  disabled={disabled}
                  findings={fieldFindings(location + "/" + key)}
                  onChange={(next) => set(location + "/" + key, next)}
                />
              ))}
              <details>
                <summary>Contract</summary>
                {contract ? (
                  <ContractView contract={contract} />
                ) : (
                  <p className="muted">Not declared</p>
                )}
                {!contract && (entry?.input || entry?.output) ? (
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() =>
                      addSchema("actors", src, {
                        ...(entry.input ? { input: entry.input } : {}),
                        ...(entry.output ? { output: entry.output } : {}),
                      })
                    }
                  >
                    Declare contract
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => onSelect(undefined)}>
                  Edit contract
                </Button>
              </details>
              <Button
                variant="ghost"
                disabled={disabled}
                onClick={() =>
                  set(
                    at,
                    rows.filter((_, n) => n !== i),
                  )
                }
              >
                Remove invoke
              </Button>
            </div>
          );
        })}
        <Button
          variant="outline"
          disabled={disabled}
          onClick={() => set(at, [...rows, { src: "thread-create" }])}
        >
          Add invoke
        </Button>
      </div>
    );
  };
  if (raw === undefined)
    return (
      <aside className="canvas-inspector">
        <p>The selection is no longer present.</p>
      </aside>
    );
  if (initial)
    return (
      <aside className="canvas-inspector">
        <h3>Initial marker</h3>
        <TextField
          label="Initial child"
          value={atPointer(document, pointer + "/initial")}
          options={Object.keys(obj(value["states"]))}
          disabled={disabled}
          onChange={(key) => onEdit({ kind: "set-initial", parent: path, key })}
        />
      </aside>
    );
  return (
    <aside
      className="canvas-inspector"
      ref={host}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <header>
        <h3>
          {type === "root"
            ? "Blueprint"
            : type === "transition"
              ? "Transition"
              : type[0]!.toUpperCase() + type.slice(1) + " state"}
        </h3>
        <Button variant="ghost" onClick={onClose} aria-label="Close inspector">
          ×
        </Button>
      </header>
      <p className="inspector-path mono" title={edge ?? path}>
        {edge ?? path}
      </p>
      {path && !edge ? (
        <TextField
          key={path}
          label="Key"
          value={path.split(".").at(-1)}
          disabled={disabled}
          onChange={(key) => onEdit({ kind: "rename-state", path, key })}
        />
      ) : null}
      {edge ? (
        <TextField
          label="Event or delay"
          value={candidate!.label}
          disabled={disabled}
          onChange={(key) => {
            const parts = edge.split("/");
            if (parts.includes("on") || parts.includes("after"))
              onEdit({ kind: "rename-key", pointer: candidate!.pointer, key });
          }}
        />
      ) : null}
      {allFields.map((group) => (
        <section key={group.title}>
          <h4>{type === "root" && group.title === "Gate" ? "Meta" : group.title}</h4>
          {group.fields
            .filter((field) => !hidden(field.key))
            .map((field) => (
              <div
                key={field.pointer}
                data-pointer={field.pointer}
                className={fieldFindings(field.pointer).length ? "has-finding" : ""}
              >
                {field.kind === "type" ? (
                  <label className="inspector-field">
                    Type
                    <select
                      aria-label="Type"
                      disabled={disabled}
                      value={String(field.value ?? (value["states"] ? "compound" : "atomic"))}
                      onChange={(event) => set(field.pointer, event.target.value)}
                    >
                      {(value["states"]
                        ? ["compound", "parallel"]
                        : ["atomic", "compound", "parallel", "final", "history"]
                      ).map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : field.kind === "text" ? (
                  <TextField
                    key={String(field.value)}
                    label={field.key}
                    value={field.value}
                    disabled={disabled}
                    onChange={(next) => set(field.pointer, next)}
                  />
                ) : field.kind === "boolean" ? (
                  <label>
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={Boolean(field.value)}
                      onChange={(event) => set(field.pointer, event.target.checked)}
                    />{" "}
                    {field.key}
                  </label>
                ) : ["entry", "exit", "actions"].includes(field.key) ? (
                  renderActions(field.value, field.pointer)
                ) : field.key === "invoke" ? (
                  renderInvoke(field.value, field.pointer)
                ) : field.key === "target" ? (
                  renderTargets(field.value, field.pointer)
                ) : field.key === "meta" && !edge ? (
                  renderGate(field.value, field.pointer)
                ) : field.key === "output" ? (
                  renderMapping(field.value, field.pointer, "Output")
                ) : field.key === "guard" ? (
                  <>
                    <select
                      aria-label="Guard kind"
                      disabled={disabled}
                      value={
                        field.value === undefined
                          ? "none"
                          : obj(field.value)["type"] === "expression.guard"
                            ? "expression"
                            : obj(field.value)["type"] === "in"
                              ? "in"
                              : "named"
                      }
                      onChange={(event) =>
                        event.target.value === "none"
                          ? onEdit({ kind: "remove", pointer: field.pointer })
                          : set(
                              field.pointer,
                              event.target.value === "expression"
                                ? { type: "expression.guard", params: { expression: "true" } }
                                : event.target.value === "in"
                                  ? { type: "in", params: { states: [] } }
                                  : { type: "" },
                            )
                      }
                    >
                      <option value="none">No guard</option>
                      <option value="expression">Expression</option>
                      <option value="in">In states</option>
                      <option value="named">Named guard</option>
                    </select>
                    {field.value === undefined ? null : obj(field.value)["type"] === "in" ? (
                      <ValueField
                        label="States"
                        value={obj(obj(field.value)["params"])["states"]}
                        disabled={disabled}
                        onChange={(next) =>
                          set(field.pointer, { type: "in", params: { states: next } })
                        }
                      />
                    ) : (
                      renderReference(field.value, field.pointer, "guard")
                    )}
                  </>
                ) : (
                  <ValueField
                    label={field.key}
                    value={field.value}
                    disabled={disabled}
                    findings={fieldFindings(field.pointer)}
                    onChange={(next) => set(field.pointer, next)}
                  />
                )}
                {field.value !== undefined ? (
                  <Button
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => onEdit({ kind: "remove", pointer: field.pointer })}
                  >
                    Remove {field.key}
                  </Button>
                ) : null}
              </div>
            ))}
        </section>
      ))}
      {!edge ? (
        <section>
          <h4>Transitions</h4>
          <Button variant="outline" disabled={disabled} onClick={() => onAddTransition?.(path)}>
            Add transition
          </Button>
          {transitionLocations(value, pointer).map((at) => (
            <Button key={at} variant="ghost" className="mono" onClick={() => onSelect(at)}>
              {transitionField(document, at).label} →{" "}
              {String(obj(atPointer(document, at))["target"] ?? atPointer(document, at))}
            </Button>
          ))}
        </section>
      ) : candidate?.index !== undefined ? (
        <section>
          <span className="mono muted">
            {candidate.index + 1} of {candidate.count}
          </span>
          <Button
            variant="outline"
            disabled={disabled || candidate.index === 0}
            onClick={() => onEdit({ kind: "move-candidate", pointer: edge, direction: -1 })}
          >
            Earlier
          </Button>
          <Button
            variant="outline"
            disabled={disabled || candidate.index === candidate.count - 1}
            onClick={() => onEdit({ kind: "move-candidate", pointer: edge, direction: 1 })}
          >
            Later
          </Button>
        </section>
      ) : null}
      {type === "root" ? (
        <section>
          <h4>Blueprint</h4>
          {[
            "description",
            "machine/context",
            "schemas/input",
            "schemas/output",
            "schemas/context",
            "schemas/events",
            "schemas/actors",
          ].map((key) => (
            <ValueField
              key={key}
              label={key}
              value={atPointer(document, "/" + key)}
              disabled={disabled}
              findings={fieldFindings("/" + key)}
              onChange={(next) => set("/" + key, next)}
            />
          ))}
          <label className="inspector-field">
            Schema name
            <input
              aria-label="Schema name"
              value={schemaName}
              disabled={disabled}
              onChange={(event) => setSchemaName(event.target.value)}
            />
          </label>
          <Button
            variant="outline"
            disabled={disabled || !schemaName}
            onClick={() => addSchema("events", schemaName, true)}
          >
            Add event schema
          </Button>
          <Button
            variant="outline"
            disabled={disabled || !schemaName}
            onClick={() => addSchema("actors", schemaName, { input: true, output: true })}
          >
            Add actor schema
          </Button>
          <p>Layout: {obj(document)["layout"] ? "Pinned" : "Automatic"}</p>
          <Button
            variant="outline"
            disabled={disabled || !obj(document)["layout"]}
            onClick={() => onEdit({ kind: "clear-layout" })}
          >
            Automatic layout
          </Button>
        </section>
      ) : null}
      <details>
        <summary>More properties</summary>
        {allFields
          .flatMap((group) => group.fields)
          .filter((field) => hidden(field.key))
          .map((field) => (
            <Button
              key={field.key}
              variant="ghost"
              disabled={disabled}
              onClick={() => setMore([...more, field.key])}
            >
              {field.key}
            </Button>
          ))}
      </details>
      {path || edge ? (
        <Button
          variant="destructive"
          disabled={disabled}
          onClick={() =>
            onEdit(
              edge ? { kind: "remove-transition", pointer: edge } : { kind: "remove-state", path },
            )
          }
        >
          Remove
        </Button>
      ) : null}
    </aside>
  );
}
function transitionLocations(value: Record<string, unknown>, pointer: string): string[] {
  const rows: string[] = [];
  const add = (at: string, row: unknown) => {
    if (Array.isArray(row)) row.forEach((_, i) => rows.push(at + "/" + i));
    else if (row !== undefined) rows.push(at);
  };
  for (const name of ["on", "after"])
    for (const [key, row] of Object.entries(obj(value[name])))
      add(pointer + "/" + name + "/" + pointerKey(key), row);
  for (const name of ["always", "onDone"]) add(pointer + "/" + name, value[name]);
  const invokes = value["invoke"];
  (invokes === undefined ? [] : Array.isArray(invokes) ? invokes : [invokes]).forEach((row, i) => {
    for (const name of ["onDone", "onError", "onSnapshot"])
      add(
        pointer + "/invoke" + (Array.isArray(invokes) ? "/" + i : "") + "/" + name,
        obj(row)[name],
      );
  });
  return rows;
}
function ContractView({ contract }: { contract: unknown }) {
  return (
    <div>
      {Object.entries(obj(contract)).map(([name, schema]) => (
        <div key={name}>
          <h5>{name}</h5>
          {obj(schema)["type"] === "object" ? (
            <table>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Type</th>
                  <th>Required</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(obj(obj(schema)["properties"])).map(([key, value]) => (
                  <tr key={key}>
                    <td className="mono">{key}</td>
                    <td>{String(obj(value)["type"] ?? "any")}</td>
                    <td>
                      {Array.isArray(obj(schema)["required"]) &&
                      (obj(schema)["required"] as unknown[]).includes(key)
                        ? "Yes"
                        : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="mono">{stringify(schema)}</pre>
          )}
        </div>
      ))}
    </div>
  );
}
