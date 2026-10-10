// ---
// relationships:
//   verifies: [blueprint-expressions, blueprint-loader]
// ---
import { expect, it, vi } from "vite-plus/test";
import { Ajv2020 } from "ajv/dist/2020.js";

it("evaluates expressions without compiling lint schemas on import", async () => {
  const compile = vi.spyOn(Ajv2020.prototype, "compile");
  try {
    const shared = await import("./index.ts");
    expect(
      await shared.evaluateExpression(shared.compileExpression("count + 1", "/guard"), {
        count: 2,
      }),
    ).toBe(3);
    expect(compile).not.toHaveBeenCalled();
  } finally {
    compile.mockRestore();
  }
});
