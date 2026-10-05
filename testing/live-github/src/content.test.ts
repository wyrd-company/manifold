// ---
// relationships:
//   verifies: live-github-environment
// ---
import { expect, it } from "vite-plus/test";
import { fileURLToPath } from "node:url";
import {
  manifestLintCommand,
  blueprintLintCommand,
  portfolioLintCommand,
} from "@wyrd-company/manifold-host-cli";
it("default content passes the host CLI manifest, blueprint, and portfolio lints", async () => {
  const directory = fileURLToPath(new URL("../content", import.meta.url));
  expect(await manifestLintCommand([directory])).toBe(0);
  expect(await blueprintLintCommand([`${directory}/blueprints/hold.yml`])).toBe(0);
  expect(await portfolioLintCommand([directory])).toBe(0);
});
