// ---
// relationships:
//   implements: host-cli-task-metadata-lint
// ---
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { lintTaskMetadataDeclaration } from "@wyrd-company/manifold-shared";
export async function readTaskMetadata(directory: string) {
  await readdir(directory);
  async function read(name: string) {
    try {
      return await readFile(join(directory, name), "utf8");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
        return undefined;
      throw error;
    }
  }
  const [taskMetadata, bindings] = await Promise.all([
    read("task-metadata.yml"),
    read("bindings.yml"),
  ]);
  return lintTaskMetadataDeclaration({ taskMetadata, bindings });
}
export function printTaskMetadataFindings(result: Awaited<ReturnType<typeof readTaskMetadata>>) {
  if (!result.ok)
    for (const finding of result.findings)
      console.log(
        `task-metadata.yml:${finding.location} ${finding.kind} ${finding.message.replaceAll(/\r?\n/g, " ")}`,
      );
}
export async function taskMetadataLintCommand(args: readonly string[]) {
  if (args.length > 1 || args[0]?.startsWith("--")) {
    console.error("task-metadata lint: expected at most one directory");
    return 2;
  }
  try {
    const result = await readTaskMetadata(args[0] ?? process.cwd());
    printTaskMetadataFindings(result);
    return result.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}
