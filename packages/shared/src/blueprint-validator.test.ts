// ---
// relationships:
//   verifies: [blueprint, operator-console]
// ---
import { expect, it } from "vite-plus/test";
import { stringify } from "yaml";
import { blueprintGraph } from "./blueprint-graph.ts";
it("accepts committed layout and ignores stale positions; rejects invalid layout shape", () => {
  const document = {
    machine: { id: "sample", initial: "waiting", states: { waiting: {} } },
    schemas: { input: true, output: true, context: true, events: {} },
  };
  expect(
    blueprintGraph(
      stringify({
        ...document,
        layout: { states: { waiting: { x: 8, y: 16 }, removed: { x: -8, y: 0 } } },
      }),
    ),
  ).toBeDefined();
  expect(
    blueprintGraph(stringify({ ...document, layout: { states: { waiting: { x: 1.5, y: 16 } } } })),
  ).toBeUndefined();
  expect(blueprintGraph(stringify({ ...document, layout: { other: {} } }))).toBeUndefined();
});
it("identifies the schema assets used to generate the browser validator", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { parse } = await import("yaml");
  const schemas = ["blueprint-expressions", "blueprint"].map((name) =>
    parse(
      readFileSync(
        new URL(`../../../docs/specifications/${name}.schema.yml`, import.meta.url),
        "utf8",
      ),
    ),
  );
  const digest = createHash("sha256").update(JSON.stringify(schemas)).digest("hex");
  expect(
    readFileSync(new URL("./blueprint-validator.js", import.meta.url), "utf8")
      .split("\n")
      .find((line) => line.startsWith("// Schema digest:")),
  ).toBe("// Schema digest: " + digest);
});
