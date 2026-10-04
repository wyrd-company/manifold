// ---
// relationships:
//   implements: host-cli-comparator-lint
// ---
import { readFile } from "node:fs/promises";
import { createComparatorLinter } from "./index.ts";
import { comparatorLintLibrary } from "./library.generated.ts";

export async function comparatorLintCommand(files: readonly string[]) {
  if (files.length === 0) {
    console.error("Usage: manifold-host comparator lint <file>...");
    return 2;
  }
  const sources = [];
  for (const name of files) {
    try {
      sources.push({ name, text: await readFile(name, "utf8") });
    } catch (error) {
      console.error(`${name}: ${String(error)}`);
      return 2;
    }
  }
  const linter = createComparatorLinter(comparatorLintLibrary);
  let exitCode = 0;
  for (const source of sources) {
    for (const diagnostic of linter.lint(source)) {
      console.log(
        `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.code} ${diagnostic.message}`,
      );
      exitCode = 1;
    }
  }
  return exitCode;
}
