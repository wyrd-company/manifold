// ---
// relationships:
//   verifies: live-github-environment
// ---
import { expect, it } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import { manifestLintCommand } from "../../../packages/host-cli/src/manifest-lint/command.ts";
import { blueprintLintCommand } from "../../../packages/host-cli/src/blueprint-lint/command.ts";
import { portfolioLintCommand } from "../../../packages/host-cli/src/portfolio-lint/command.ts";
it("default content passes the host CLI manifest, blueprint, and portfolio lints", async () => {
  const directory = fileURLToPath(new URL("../content", import.meta.url));
  expect(await manifestLintCommand([directory])).toBe(0);
  expect(await blueprintLintCommand([`${directory}/blueprints/hold.yml`])).toBe(0);
  expect(await portfolioLintCommand([directory])).toBe(0);
});
