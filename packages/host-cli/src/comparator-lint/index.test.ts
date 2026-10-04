// ---
// relationships:
//   verifies: host-cli-comparator-lint
// ---
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vite-plus/test";
import { createComparatorLinter } from "./index.ts";

const require = createRequire(import.meta.url);
const libDirectory = dirname(require.resolve("typescript"));
const libFiles = new Map<string, string>();
function collect(name: string) {
  if (libFiles.has(name)) return;
  const text = readFileSync(join(libDirectory, name), "utf8");
  libFiles.set(name, text);
  for (const reference of ts.preProcessFile(text).libReferenceDirectives)
    collect(`lib.${reference.fileName}.d.ts`);
}
collect("lib.es2022.d.ts");
const contract = readFileSync(
  new URL("../../../shared/src/comparator.d.ts", import.meta.url),
  "utf8",
);
const linter = createComparatorLinter({ contract, libFiles });
const good =
  'import type { Comparator } from "manifold:comparator"; const pick: Comparator = input => input.population.length ? { task: input.population[0]!.id } : null; export default pick;';
const lint = (text: string) => linter.lint({ name: "sample.ts", text });

describe("comparator lint", () => {
  it("accepts a comparator without executing it", () => {
    expect(lint(`throw new Error('must not execute'); ${good}`)).toEqual([]);
    expect(lint(good)).toEqual([]);
  });
  it.each(["export default (a: number, b: number) => null;", "export default async () => null;"])(
    "rejects a wrong signature: %s",
    (text) => {
      expect(lint(text)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: "TS2322", file: "sample.ts", line: 1, column: 1 }),
        ]),
      );
    },
  );
  it.each([
    "setTimeout(() => {}, 1)",
    'fetch("https://example.invalid")',
    "process.env",
    'require("external")',
    "console.log(1)",
  ])("rejects an undeclared host global: %s", (expression) => {
    expect(
      lint(`export default () => { ${expression}; return null; };`).some((d) =>
        /^TS(2304|2591|2584)$/.test(d.code),
      ),
    ).toBe(true);
  });
  it.each(["Date.now()", "new Date()", "const clock = Date; clock.now()"])(
    "rejects library clock references: %s",
    (expression) => {
      expect(lint(`export default () => { ${expression}; return null; };`)).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "comparator/no-clock" })]),
      );
    },
  );
  it.each(["Math.random()", "const draw = Math.random; draw()", 'Math["random"]()'])(
    "rejects library random references: %s",
    (expression) => {
      expect(lint(`export default () => { ${expression}; return null; };`)).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: "comparator/no-math-random" })]),
      );
    },
  );
  it("permits local names that shadow the library", () => {
    expect(
      lint(
        'import type { ComparatorInput } from "manifold:comparator"; export default (input: ComparatorInput) => { const Date = { now: () => 1 }; const Math = { random: () => 1 }; Date.now(); Math.random(); const random = input.random; random(); Array.isArray([]); Number.isFinite(1); return null; };',
      ),
    ).toEqual([]);
  });
  it.each([
    'import { Comparator } from "manifold:comparator"; const pick: Comparator = () => null; export default pick;',
    "export const pick = () => null;",
    'import x from "external"; export default () => x;',
    "export default () => {",
  ])("reports module and syntax errors: %s", (text) => {
    expect(lint(text).length).toBeGreaterThan(0);
  });
  it("reports source locations in order", () => {
    const diagnostics = lint(
      'export default () => {\n  fetch("https://example.invalid");\n  Date.now();\n  Math.random();\n  return null;\n};',
    );
    expect(diagnostics.map((d) => [d.file, d.line, d.column])).toEqual([
      ["sample.ts", 2, 3],
      ["sample.ts", 3, 3],
      ["sample.ts", 4, 3],
    ]);
  });
  it("embeds exactly the installed ES2022 library closure and shared contract", () => {
    const generated = readFileSync(new URL("./library.generated.ts", import.meta.url), "utf8");
    const names = [...generated.matchAll(/import lib\d+ from "typescript\/lib\/(.*?)"/g)]
      .map((match) => match[1])
      .sort();
    expect(names).toEqual([...libFiles.keys()].sort());
    expect(generated).toContain('from "@wyrd-company/manifold-shared/comparator.d.ts"');
  });
  it("runs the compiled binary with no node_modules and never executes source", () => {
    const cache = resolve("node_modules/.cache");
    mkdirSync(cache, { recursive: true });
    const directory = mkdtempSync(join(cache, "comparator-binary-"));
    const executable = join(directory, "manifold-host");
    try {
      const build = spawnSync(
        "bun",
        ["build", "src/cli.ts", "--compile", "--outfile", executable],
        { encoding: "utf8" },
      );
      expect(build.status, build.stderr).toBe(0);
      writeFileSync(join(directory, "good.ts"), `throw new Error('must not execute'); ${good}`);
      writeFileSync(join(directory, "wrong.ts"), "export default async () => null;");
      const run = (...args: string[]) =>
        spawnSync(executable, args, { cwd: directory, encoding: "utf8" });
      const clean = run("comparator", "lint", "good.ts");
      expect([clean.status, clean.stdout, clean.stderr]).toEqual([0, "", ""]);
      const wrong = run("comparator", "lint", "wrong.ts");
      expect(wrong.status).toBe(1);
      expect(wrong.stdout).toContain("wrong.ts:1:1 TS2322");
      expect(run("comparator", "lint").status).toBe(2);
      const unreadable = run("comparator", "lint", "wrong.ts", "missing.ts");
      expect(unreadable.status).toBe(2);
      expect(unreadable.stdout).toBe("");
      expect(unreadable.stderr).toContain("missing.ts");
      const multiple = run("comparator", "lint", "wrong.ts", "good.ts", "wrong.ts");
      expect(multiple.status).toBe(1);
      expect(multiple.stdout.split("\n").filter(Boolean)).toHaveLength(2);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
