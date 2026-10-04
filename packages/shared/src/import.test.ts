// ---
// relationships:
//   verifies: [blueprint-expressions, blueprint-loader]
// ---
import { expect, it, vi } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";

it("evaluates expressions without compiling the blueprint lint schema on import", async () => {
  const compile = vi.spyOn(Ajv2020.prototype, "compile");
  try {
    const shared = await import("./index.ts");
    expect(
      await shared.evaluateExpression(shared.compileExpression("count + 1", "/guard"), {
        count: 2,
      }),
    ).toBe(3);
    expect(
      compile.mock.calls.some(
        ([schema]) =>
          typeof schema === "object" &&
          schema !== null &&
          "$ref" in schema &&
          schema["$ref"] === "https://manifold.wyrd.company/schemas/blueprint#/$defs/blueprint",
      ),
    ).toBe(false);
  } finally {
    compile.mockRestore();
  }
});
