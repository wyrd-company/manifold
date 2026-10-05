// ---
// relationships:
//   implements: host-cli-usage
// ---
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { lintUsageDeclaration } from "@wyrd-company/manifold-shared";
export async function usageLintCommand(
  args: readonly string[],
  io: { stdout: Writable; stderr: Writable } = process,
): Promise<number> {
  if (args.length > 1 || args[0]?.startsWith("-")) {
    io.stderr.write("usage lint: expected at most one directory\n");
    return 2;
  }
  const directory = args[0] ?? process.cwd();
  async function read(name: string) {
    try {
      return await readFile(join(directory, name), "utf8");
    } catch (error) {
      if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT")
        return undefined;
      throw error;
    }
  }
  try {
    await readdir(directory);
    const [accounts, prices] = await Promise.all([read("accounts.yml"), read("prices.yml")]);
    const result = lintUsageDeclaration({ accounts, prices });
    if (result.ok) return 0;
    for (const finding of result.findings)
      io.stdout.write(
        `${finding.file}.yml:${finding.location} ${finding.kind} ${finding.message.replace(/\s*\r?\n\s*/g, " ")}\n`,
      );
    return 1;
  } catch (error) {
    io.stderr.write(`${directory}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}
