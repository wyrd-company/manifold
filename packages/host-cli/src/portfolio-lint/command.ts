// ---
// relationships:
//   implements: host-cli-portfolio-lint
// ---
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { lintAllocatedAccounts, lintPortfolioDeclaration } from "@wyrd-company/manifold-shared";

export async function portfolioLintCommand(args: readonly string[]): Promise<number> {
  if (args.length > 1) {
    process.stderr.write("portfolio lint: expected at most one directory\n");
    return 2;
  }
  const directory = args[0] ?? process.cwd();
  let file = directory;
  let portfolio: string | undefined;
  let bindings: string | undefined;
  let accounts: string | undefined;
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
    portfolio = await read("portfolio.yml");
    bindings = await read("bindings.yml");
    accounts = await read("accounts.yml");
  } catch (error) {
    process.stderr.write(`${file}: ${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }
  const result = lintPortfolioDeclaration({ portfolio, bindings });
  for (const finding of result.ok ? [] : result.findings) {
    const message = finding.message.replace(/\s*\r?\n\s*/g, " ");
    process.stdout.write(`${finding.file}.yml:${finding.location} ${finding.kind} ${message}\n`);
  }
  for (const warning of lintAllocatedAccounts({ portfolio, accounts }))
    process.stdout.write(
      `${warning.file}.yml:${warning.location} ${warning.kind} ${warning.message} (warning)\n`,
    );
  return result.ok ? 0 : 1;
}
