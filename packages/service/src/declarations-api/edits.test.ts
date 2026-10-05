// ---
// relationships:
//   implements: declarations-api
// ---
import { describe, expect, it } from "vite-plus/test";
import { editBindings } from "./binding-edit.ts";
import { editTaskFields } from "./task-field-edit.ts";
import { taskFieldRows } from "./task-fields.ts";
describe("declaration edits", () => {
  it("adds a binding and preserves comments and archived on replacement", () => {
    const text =
      "githubProjects:\n  # keep\n  sample:\n    owner: sample\n    number: 1\n    environment: local\n    item: work\n    archived: true\n";
    const result = editBindings(text, {
      kind: "github-project",
      mode: "replace",
      name: "sample",
      owner: "sample",
      number: 2,
      environment: "local",
      item: "work",
      t3codeProjects: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("# keep");
      expect(result.text).toContain("archived: true");
      expect(result.text).toContain("number: 2");
    }
    expect(
      editBindings(text, {
        kind: "t3code-project",
        mode: "add",
        name: "sample",
        environment: "local",
        project: "workspace",
        item: "work",
      }).ok,
    ).toBe(false);
  });
  it("adds successive fields and locks lifecycle", () => {
    const text =
      "projects:\n  sample:\n    lifecycle:\n      field: Status\n      options: [Open, Done]\n";
    const first = editTaskFields(text, { kind: "add-field", binding: "sample" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = editTaskFields(first.text, { kind: "add-field", binding: "sample" });
    expect(second.ok).toBe(true);
    if (second.ok)
      expect(taskFieldRows(second.text)?.map((row) => row.name)).toEqual([
        "Status",
        "field-1",
        "field-2",
      ]);
    expect(
      editTaskFields(text, { kind: "remove-field", location: "/projects/sample/lifecycle" }),
    ).toMatchObject({ ok: false, findings: [{ kind: "field-locked" }] });
  });
  it("renames one option in place preserving its color and other fields", () => {
    const text =
      "projects:\n  sample:\n    fields:\n      Choice:\n        type: single-select\n        options:\n          - name: Old\n            color: BLUE\n      # untouched\n      Notes:\n        type: text\n";
    const result = editTaskFields(text, {
      kind: "set-field",
      location: "/projects/sample/fields/Choice",
      values: { options: ["New"] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toContain("color: BLUE");
      expect(result.text).toContain("# untouched\n      Notes:\n        type: text");
    }
  });
  it("returns draft values even when invalid and omits rows on syntax errors", () => {
    expect(
      taskFieldRows(
        'projects:\n  Invalid name:\n    fields:\n      sample:\n        type: ""\n        storage:\n          kind: unknown\n',
      )?.[0],
    ).toMatchObject({ binding: "Invalid name", name: "sample", type: "", storage: "unknown" });
    expect(taskFieldRows("projects: [")).toBeUndefined();
  });
});
