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
  taskMetadataDeclarationSchema,
} from "./index.ts";
import { lintBlueprint } from "./blueprint-lint.ts";
import { manifoldImplementationNames } from "./implementation-names.ts";
const bindings = `githubProjects:\n  parcels: { owner: sample, number: 1, environment: local, item: shipments }`;
const metadata = `projects:\n  parcels:\n    lifecycle: { field: Stage, options: [Sorting, Packed] }`;
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
test("absent metadata declares no lifecycle and archived bindings still declare options", () => {
  expect(lintTaskMetadataDeclaration({ taskMetadata: undefined, bindings: undefined })).toEqual({
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
test.each([
  [metadata.replace("parcels:", "returns:"), "unknown-binding"],
  [metadata.replace("[Sorting, Packed]", "[Packed, Packed]"), "schema"],
  [metadata.replace("Stage", '" Stage"'), "schema"],
  [metadata + "\nprojects: {}", "syntax"],
  ["%YAML 1.1\n---\nprojects: {}", "syntax"],
  ["projects: &loop { parcels: *loop }", "schema"],
])("rejects invalid metadata %s", (text, kind) => {
  const result = lintTaskMetadataDeclaration({ taskMetadata: text, bindings });
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.findings.some((f) => f.kind === kind)).toBe(true);
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
