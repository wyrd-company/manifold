// ---
// relationships:
//   verifies: default-task-blueprint
// ---
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { expect, it } from "vite-plus/test";
import { lintBlueprint } from "./blueprint-lint.ts";
import { manifoldImplementationNames } from "./implementation-names.ts";
it("ships the specified machine with a proved gate and no lint findings or warnings", async () => {
  const text = readFileSync(
    new URL("../../service/bundle/blueprints/task.yml", import.meta.url),
    "utf8",
  );
  const spec = parse(
    readFileSync(
      new URL("../../../docs/specifications/default-task-blueprint.yml", import.meta.url),
      "utf8",
    ),
  );
  expect(parse(text).machine).toEqual(
    parse(spec.description.match(/```yaml\n([\s\S]+?)\n```/)[1]).machine,
  );
  const result = await lintBlueprint("blueprints/task.yml", text, manifoldImplementationNames);
  expect(result.ok ? [] : result.findings).toEqual([]);
  expect(result.ok).toBe(true);
  expect(result.warnings).toEqual([]);
  if (result.ok)
    expect(result.tokens.gates).toEqual([expect.objectContaining({ verdict: "proved" })]);
});
