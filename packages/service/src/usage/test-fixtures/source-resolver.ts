// ---
// relationships:
//   verifies: usage-intake
// ---
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
// Source-mode worker: ledger sources use the emitted .js extension.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && specifier.endsWith(".js") && context.parentURL) {
      const source = new URL(specifier.slice(0, -3) + ".ts", context.parentURL);
      if (existsSync(fileURLToPath(source))) return nextResolve(source.href, context);
    }
    return nextResolve(specifier, context);
  },
});
