// ---
// relationships:
//   verifies: default-process
// ---
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { expect, it, vi } from "vite-plus/test";
import { lintUsageDeclaration } from "@wyrd-company/manifold-shared";
import { manifestLintCommand } from "./manifest-lint/command.ts";
import { portfolioLintCommand } from "./portfolio-lint/command.ts";
import { comparatorLintCommand } from "./comparator-lint/command.ts";
import { blueprintLintCommand } from "./blueprint-lint/command.ts";
// Vite does not implement Bun's text imports; load the same declaration texts.
vi.mock("./comparator-lint/library.generated.ts", async () => {
  const { readFileSync } = await import("node:fs");
  const { createRequire } = await import("node:module");
  const { dirname, join } = await import("node:path");
  const ts = (await import("typescript")).default;
  const directory = dirname(createRequire(import.meta.url).resolve("typescript"));
  const libFiles = new Map<string, string>();
  function collect(name: string) {
    if (libFiles.has(name)) return;
    const text = readFileSync(join(directory, name), "utf8");
    libFiles.set(name, text);
    for (const ref of ts.preProcessFile(text).libReferenceDirectives)
      collect(`lib.${ref.fileName}.d.ts`);
  }
  collect("lib.es2022.d.ts");
  return {
    comparatorLintLibrary: {
      contract: readFileSync(new URL("../../shared/src/comparator.d.ts", import.meta.url), "utf8"),
      libFiles,
    },
  };
});
const starter = fileURLToPath(new URL("../../../examples/starter", import.meta.url));
it("passes the shipped host lints and pending seam declaration checks", async () => {
  expect(await manifestLintCommand([starter])).toBe(0);
  expect(await portfolioLintCommand([starter])).toBe(0);
  expect(await comparatorLintCommand([join(starter, "comparators/estimate.ts")])).toBe(0);
  expect(
    await blueprintLintCommand([
      fileURLToPath(new URL("../../service/bundle/blueprints/task.yml", import.meta.url)),
    ]),
  ).toBe(0);
  // Structural stand-ins for usage lint and task-metadata lint until their owners merge.
  const accounts = parse(await readFile(join(starter, "accounts.yml"), "utf8"));
  expect(accounts.accounts.agents).toMatchObject({
    kind: "api",
    unit: "usd",
    capacity: { amount: 100, reset: "2026-01-01T00:00:00Z", every: { months: 1 } },
  });
  const { kind: _kind, capacity: _capacity, ...usage } = accounts.accounts.agents;
  expect(
    lintUsageDeclaration({
      accounts: stringify({ accounts: { agents: usage } }),
      prices: undefined,
    }).ok,
  ).toBe(true);
  const metadata = parse(await readFile(join(starter, "task-metadata.yml"), "utf8"));
  const bindings = parse(await readFile(join(starter, "bindings.yml"), "utf8"));
  for (const [name, value] of Object.entries(metadata.projects) as [
    string,
    { lifecycle: { field: string; options: string[] } },
  ][]) {
    expect(bindings.githubProjects[name]).toBeDefined();
    expect(value.lifecycle.field).toBe("Status");
    expect(value.lifecycle.options).toEqual(["Todo", "In Progress", "Done"]);
  }
});
