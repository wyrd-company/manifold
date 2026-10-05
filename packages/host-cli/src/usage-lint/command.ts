// ---
// relationships:
//   implements: host-cli-usage
// ---
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import type { Writable } from "node:stream";
import { lintAllocatedAccounts, lintUsageDeclaration } from "@wyrd-company/manifold-shared";
export async function usageLintCommand(
  args: readonly string[],
  io: { stdout: Writable; stderr: Writable } = process,
): Promise<number> {
  if (args.length > 1 || args[0]?.startsWith("-")) {
    io.stderr.write("usage lint: expected at most one directory\n");
    return 2;
  }
  const directory = args[0] ?? process.cwd();
  let file = directory;
  async function read(name: string) {
    file = name;
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
    const accounts = await read("accounts.yml");
    const prices = await read("prices.yml");
    const portfolio = await read("portfolio.yml");
    const result = lintUsageDeclaration({ accounts, prices });
    const findings = ["accounts", "prices"].flatMap((name) =>
      (result.ok ? [] : result.findings).filter((finding) => finding.file === name),
    );
    for (const finding of findings)
      io.stdout.write(
        `${finding.file}.yml:${finding.location} ${finding.kind} ${finding.message.replace(/\s*\r?\n\s*/g, " ")}\n`,
      );
    for (const warning of lintAllocatedAccounts({ portfolio, accounts }))
      io.stdout.write(
        `${warning.file}.yml:${warning.location} ${warning.kind} ${warning.message} (warning)\n`,
      );
    return result.ok ? 0 : 1;
  } catch (error) {
    io.stderr.write(`${file}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
}
