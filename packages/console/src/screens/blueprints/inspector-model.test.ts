// ---
// relationships:
//   verifies: operator-console
// ---
import { expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { inspectorModel } from "./inspector-model.ts";
import { applyBlueprintEdit } from "./blueprint-edits.ts";
const schema = parse(
  readFileSync(
    new URL("../../../../../docs/specifications/blueprint.schema.yml", import.meta.url),
    "utf8",
  ),
);
it("provides a writable field for every state and transition schema property", () => {
  for (const type of ["atomic", "compound", "parallel", "final", "history", "root", "transition"]) {
    const pointer = type === "transition" ? "/machine/states/a/on/NEXT" : "/machine/states/a";
    const fields = inspectorModel(type, {}, pointer).flatMap((group) => group.fields);
    const properties = Object.keys(
      (type === "transition"
        ? schema.$defs.transition.oneOf[1]
        : schema.$defs["state-node-properties"]
      ).properties,
    );
    expect(fields.map((field) => field.key).sort()).toEqual(
      properties.filter((key) => key !== "states").sort(),
    );
    for (const field of fields) {
      const text = "machine:\n  states:\n    a:\n      on:\n        NEXT: {}\n";
      const result = applyBlueprintEdit(text, {
        kind: "set",
        pointer: field.pointer,
        value: "test",
      });
      expect(result.ok, field.pointer).toBe(true);
      if (result.ok) expect(result.text).toContain("test");
    }
  }
});
