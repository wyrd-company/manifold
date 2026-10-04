// ---
// relationships:
//   implements: host-cli-manifest-lint
// ---
import { lstat, readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { lintProcessManifest } from "@wyrd-company/manifold-shared";
export async function manifestLintCommand(args: readonly string[]): Promise<number> {
  if (args.length > 1) {
    process.stderr.write("manifest lint: expected at most one directory\n");
    return 2;
  }
  const directory = resolve(args[0] ?? ".");
  let file = directory;
  try {
    await readdir(directory);
    const result = await lintProcessManifest(async (path) => {
      file = path;
      let current = directory;
      for (const part of path.split("/")) {
        current = join(current, part);
        try {
          if ((await lstat(current)).isSymbolicLink()) return undefined;
        } catch (error) {
          if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
            return undefined;
          throw error;
        }
      }
      return readFile(current, "utf8");
    });
    for (const f of result.findings)
      process.stdout.write(
        `${f.file}:${f.location} ${f.finding?.kind ?? f.kind} ${f.message}${f.severity === "warning" ? " (warning)" : ""}\n`,
      );
    return result.ok ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${file}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}
