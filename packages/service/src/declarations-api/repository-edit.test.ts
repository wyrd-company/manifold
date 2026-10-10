// ---
// relationships:
//   verifies: declarations-api
// ---
import { expect, test } from "vite-plus/test";
import { editTaskFields } from "./task-field-edit.ts";
import { taskFieldEdit } from "./request-checks.ts";
test("repositories edit preserves comments and field configuration, and empty scope deletes the key", () => {
  const text =
    "# retained\nprojects:\n  parcels:\n    lifecycle: { field: Stage, options: [Packed] }\n    # field comment\n    fields: { size: {type: single-select, storage: {kind: label, prefix: 'size: '}, options: [Small]} }\n";
  const edit = {
    kind: "set-repositories" as const,
    binding: "parcels",
    repositories: ["sample/depot", "sample/*"],
  };
  expect(taskFieldEdit(edit)).toBe(true);
  const result = editTaskFields(text, edit);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.text).toContain("# retained");
  expect(result.text).toContain("# field comment");
  expect(result.text.indexOf("repositories:")).toBeLessThan(result.text.indexOf("fields:"));
  const empty = editTaskFields(result.text, { ...edit, repositories: [] });
  expect(empty.ok && empty.text).not.toContain("repositories:");
  expect(editTaskFields(text, { ...edit, binding: "absent" }).ok).toBe(false);
});
