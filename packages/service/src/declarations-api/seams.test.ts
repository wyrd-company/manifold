// ---
// relationships:
//   verifies: declarations-api
// ---
import { expect, test } from "vite-plus/test";
import { lintTaskMetadata } from "./seams.ts";
const bindings =
  "githubProjects:\n  sample:\n    owner: example\n    number: 1\n    environment: local\n    item: work\n";
const text =
  "projects:\n  sample:\n    lifecycle:\n      field: Stage\n      options: [Open, Done]\n    fields:\n      Priority:\n        type: single-select\n        options: [Urgent, Routine]\n      Notes:\n        type: text\n";
test("structural metadata seam accepts and normalizes declared fields", () => {
  const result = lintTaskMetadata({ taskMetadata: text, bindings });
  expect(result.ok).toBe(true);
  if (result.ok)
    expect(result.declaration.projects["sample"]?.fields["Priority"]).toMatchObject({
      storage: { kind: "project-field", name: "Priority" },
      whenChanged: "revert",
      options: [{ name: "Urgent" }, { name: "Routine" }],
    });
});
test("structural metadata seam validates full shape and duplicates", () => {
  const schema = lintTaskMetadata({
    taskMetadata: text.replace("type: text", "type: unknown"),
    bindings,
  });
  expect(schema.ok).toBe(false);
  if (!schema.ok)
    expect(schema.findings).toContainEqual(
      expect.objectContaining({ kind: "schema", location: "/projects/sample/fields/Notes/type" }),
    );
  const duplicate = lintTaskMetadata({
    taskMetadata: text.replace("options: [Urgent, Routine]", "options: [Urgent, Urgent]"),
    bindings,
  });
  expect(duplicate).toMatchObject({
    ok: false,
    findings: [
      { kind: "duplicate-option", location: "/projects/sample/fields/Priority/options/1" },
    ],
  });
  const field = lintTaskMetadata({
    taskMetadata: text.replace(
      "Notes:\n        type: text",
      "Notes:\n        type: text\n        storage:\n          kind: project-field\n          name: Stage",
    ),
    bindings,
  });
  expect(field).toMatchObject({
    ok: false,
    findings: [{ kind: "duplicate-field", location: "/projects/sample/fields/Notes" }],
  });
});
