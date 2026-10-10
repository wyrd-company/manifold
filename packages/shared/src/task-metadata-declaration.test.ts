// ---
// relationships:
//   verifies: [task-metadata-declaration, blueprint]
// ---
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { expect, test } from "vite-plus/test";
import {
  lintTaskMetadataDeclaration,
  declaredLifecycleOptions,
  taskFieldStorageKinds,
  taskMetadataDeclarationSchema,
} from "./index.ts";
import { lintBlueprint } from "./blueprint-lint.ts";
import { manifoldImplementationNames } from "./implementation-names.ts";
const bindings = `githubProjects:\n  parcels: { owner: sample, number: 1, environment: local, item: shipments }`;
const twoBindings = `githubProjects:
  parcels: { owner: sample, number: 1, environment: local, item: shipments }
  returns: { owner: sample, number: 2, environment: local, item: refunds }`;
const metadata = `projects:\n  parcels:\n    lifecycle: { field: Stage, options: [Sorting, Packed] }`;
/** Wrap a parcels Project body, each line already indented four spaces. */
const project = (body: string) => `projects:\n  parcels:\n${body}`;
const example = `projects:
  parcels:
    lifecycle:
      field: Stage
      options: [Sorting, Packed, Shipped]
    fields:
      Priority:
        type: single-select
        storage:
          kind: project-field
          name: Urgency
        options:
          - name: Urgent
            color: red
            description: Leaves today
          - Routine
      Weight:
        type: number
      Courier notes:
        type: text
        whenChanged: accept
  returns:
    lifecycle:
      field: Stage
      options: [Received, Inspected]`;
test("metadata schema agrees with the declaration asset", () => {
  expect(taskMetadataDeclarationSchema).toEqual(
    parse(
      readFileSync(
        new URL(
          "../../../docs/specifications/task-metadata-declaration.schema.yml",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
});
test("the storage kinds table is exported from one source", () => {
  expect(taskFieldStorageKinds.slice(0, 1)).toMatchObject([
    {
      kind: "project-field",
      types: ["text", "number", "date", "single-select"],
      settings: ["name"],
    },
  ]);
});
test("all six storage kinds are offered in contract order", () => {
  expect(taskFieldStorageKinds.map((kind) => kind.kind)).toEqual([
    "project-field",
    "issue-field",
    "issue-type",
    "label",
    "milestone",
    "front-matter",
  ]);
});
test("absent metadata declares no Project and archived bindings still declare options", () => {
  expect(lintTaskMetadataDeclaration({ taskMetadata: undefined, bindings: undefined })).toEqual({
    ok: true,
    declaration: { projects: {} },
  });
  expect(lintTaskMetadataDeclaration({ taskMetadata: "", bindings: undefined })).toEqual({
    ok: true,
    declaration: { projects: {} },
  });
  const result = lintTaskMetadataDeclaration({
    taskMetadata: metadata,
    bindings: bindings.replace("item: shipments", "item: shipments, archived: true"),
  });
  expect(result.ok).toBe(true);
  if (result.ok)
    expect([...declaredLifecycleOptions(result.declaration)]).toEqual(["Packed", "Sorting"]);
});
test("the specification example lints clean with defaults applied", () => {
  const result = lintTaskMetadataDeclaration({ taskMetadata: example, bindings: twoBindings });
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect([...declaredLifecycleOptions(result.declaration)]).toEqual([
    "Inspected",
    "Packed",
    "Received",
    "Shipped",
    "Sorting",
  ]);
  const parcels = result.declaration.projects["parcels"]!;
  expect(Object.keys(parcels.fields)).toEqual(["Priority", "Weight", "Courier notes"]);
  const priority = parcels.fields["Priority"]!;
  expect(priority).toEqual({
    type: "single-select",
    storage: { kind: "project-field", name: "Urgency" },
    whenChanged: "revert",
    options: [{ name: "Urgent", color: "red", description: "Leaves today" }, { name: "Routine" }],
  });
  expect(parcels.fields["Weight"]).toEqual({
    type: "number",
    storage: { kind: "project-field", name: "Weight" },
    whenChanged: "revert",
  });
  expect(parcels.fields["Courier notes"]!.whenChanged).toBe("accept");
});
test("the same texts give the same result", () => {
  const files = { taskMetadata: example, bindings: twoBindings };
  expect(lintTaskMetadataDeclaration(files)).toEqual(lintTaskMetadataDeclaration(files));
});
test.each([
  // lifecycle
  [project(`    fields: { Weight: { type: number } }`), "schema"],
  [project(`    lifecycle: { field: Stage, options: [] }`), "schema"],
  [project(`    lifecycle: { field: Stage, options: [Packed, Packed] }`), "schema"],
  [project(`    lifecycle: { field: Stage, options: [" Packed"] }`), "schema"],
  // unknown keys at each level
  [`extra: true\n${project(`    lifecycle: { field: Stage, options: [Packed] }`)}`, "schema"],
  [project(`    lifecycle: { field: Stage, options: [Packed], extra: true }`), "schema"],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Weight: { type: number, extra: true } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Weight: { type: number, storage: { kind: project-field, extra: true } } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Priority: { type: single-select, options: [ { name: Urgent, extra: true } ] } }`,
    ),
    "schema",
  ],
  // task field shape
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Weight: { type: number, storage: { kind: labels } } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Weight: { type: slider } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Priority: { type: single-select } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Priority: { type: single-select, options: [] } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Note: { type: text, options: [A] } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Priority: { type: single-select, options: [ { name: Urgent, color: teal } ] } }`,
    ),
    "schema",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Weight: { type: number, whenChanged: ignore } }`,
    ),
    "schema",
  ],
  // syntax
  [metadata + "\nprojects: {}", "syntax"],
  ["%YAML 1.1\n---\nprojects: {}", "syntax"],
  ["projects: &loop { parcels: *loop }", "schema"],
])("rejects invalid metadata %#", (text, kind) => {
  const result = lintTaskMetadataDeclaration({ taskMetadata: text, bindings });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.findings.some((f) => f.kind === kind)).toBe(true);
    // A document with a schema or syntax finding reports nothing else.
    if (kind === "schema") expect(result.findings.every((f) => f.kind === "schema")).toBe(true);
  }
});
test.each([
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Stage: { type: number } }`,
    ),
    "/projects/parcels/fields/Stage",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Priority: { type: number, storage: { kind: project-field, name: Stage } } }`,
    ),
    "/projects/parcels/fields/Priority",
  ],
  [
    project(
      `    lifecycle: { field: Stage, options: [Packed] }\n    fields:\n      Weight: { type: number }\n      Mass: { type: number, storage: { kind: project-field, name: Weight } }`,
    ),
    "/projects/parcels/fields/Mass",
  ],
])("reports a duplicate project field at %s", (text, location) => {
  const result = lintTaskMetadataDeclaration({ taskMetadata: text, bindings });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.findings).toContainEqual(
      expect.objectContaining({ kind: "duplicate-field", location }),
    );
});
test("reports a duplicate option at the later option", () => {
  const text = project(
    `    lifecycle: { field: Stage, options: [Packed] }\n    fields: { Priority: { type: single-select, options: [ Routine, { name: Routine, color: gray } ] } }`,
  );
  const result = lintTaskMetadataDeclaration({ taskMetadata: text, bindings });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "duplicate-option",
        location: "/projects/parcels/fields/Priority/options/1",
      }),
    );
});
test.each([
  [metadata.replace("parcels:", "returns:"), bindings, "unknown-binding"],
  [
    metadata,
    `t3codeProjects:\n  parcels: { environment: local, project: project-1, item: shipments }`,
    "unknown-binding",
  ],
])("names an unknown binding %#", (text, bindingsText, kind) => {
  const result = lintTaskMetadataDeclaration({ taskMetadata: text, bindings: bindingsText });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.findings.some((f) => f.kind === kind)).toBe(true);
});
test("does not report an unknown binding when the binding document does not parse", () => {
  expect(
    lintTaskMetadataDeclaration({
      taskMetadata: metadata.replace("parcels:", "returns:"),
      bindings: "[",
    }).ok,
  ).toBe(true);
});
test("metadata lint only requires the binding document's shape, not portfolio resolution", () => {
  expect(lintTaskMetadataDeclaration({ taskMetadata: metadata, bindings }).ok).toBe(true);
  expect(
    lintTaskMetadataDeclaration({ taskMetadata: metadata, bindings: "githubProjects: []" }).ok,
  ).toBe(true);
});
const blueprint = (input: unknown) =>
  stringify({
    schemas: {
      input: true,
      output: true,
      context: true,
      events: {},
      actors: { "github-card-move": { input: true, output: true } },
    },
    machine: {
      initial: "packing",
      states: {
        packing: { invoke: { src: "github-card-move", input, onDone: "done" } },
        done: { type: "final" },
      },
    },
  });
test("blueprint lint checks only literal string statuses when lifecycle options are supplied", async () => {
  expect(
    (
      await lintBlueprint(
        "blueprints/parcel.yml",
        blueprint({ status: "Packed" }),
        manifoldImplementationNames,
        { lifecycleOptions: new Set(["Packed"]) },
      )
    ).ok,
  ).toBe(true);
  const bad = await lintBlueprint(
    "blueprints/parcel.yml",
    blueprint({ status: "Packde" }),
    manifoldImplementationNames,
    { lifecycleOptions: new Set(["Packed"]) },
  );
  expect(bad.ok).toBe(false);
  if (!bad.ok)
    expect(bad.findings).toContainEqual(
      expect.objectContaining({
        kind: "lifecycle-option",
        location: "/machine/states/packing/invoke/input/status",
      }),
    );
  expect(
    (
      await lintBlueprint(
        "blueprints/parcel.yml",
        blueprint({ status: "Packde" }),
        manifoldImplementationNames,
      )
    ).ok,
  ).toBe(true);
  expect(
    (
      await lintBlueprint(
        "blueprints/parcel.yml",
        blueprint({ mapping: '{"status": "Packed"}' }),
        manifoldImplementationNames,
        { lifecycleOptions: new Set() },
      )
    ).ok,
  ).toBe(true);
});

test("lifecycle rule follows structural findings and does not suppress token lint", async () => {
  const doc = parse(blueprint({ status: "Unknown" }));
  doc.machine.states.packing.meta = {
    gate: { comparator: "comparators/order.ts", return: { state: "returned" } },
  };
  doc.machine.states.packing.on = { token: "trapped" };
  doc.machine.states.trapped = {};
  doc.machine.states.returned = {};
  const result = await lintBlueprint(
    "blueprints/parcel.yml",
    stringify(doc),
    manifoldImplementationNames,
    { lifecycleOptions: new Set() },
  );
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.findings.map((f) => f.kind)).toEqual(["token-violation", "lifecycle-option"]);
  delete doc.machine.states.done;
  delete doc.machine.states.packing.invoke.onDone;
  const structural = await lintBlueprint(
    "blueprints/parcel.yml",
    stringify(doc),
    manifoldImplementationNames,
    { lifecycleOptions: new Set() },
  );
  expect(structural.ok).toBe(false);
  if (!structural.ok)
    expect(structural.findings.map((f) => f.kind)).toEqual([
      "final-state-missing",
      "lifecycle-option",
    ]);
});
test("lifecycle findings use location order within their rule", async () => {
  const doc = parse(blueprint({ status: "Unknown" }));
  doc.machine.initial = "z";
  doc.machine.states = {
    z: doc.machine.states.packing,
    a: doc.machine.states.packing,
    done: doc.machine.states.done,
  };
  const result = await lintBlueprint(
    "blueprints/parcel.yml",
    stringify(doc),
    manifoldImplementationNames,
    { lifecycleOptions: new Set() },
  );
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.findings.map((f) => f.location)).toEqual([
      "/machine/states/a/invoke/input/status",
      "/machine/states/z/invoke/input/status",
    ]);
});
