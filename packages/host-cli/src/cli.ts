// ---
// relationships:
//   implements: [host-cli-usage, host-cli-comparator-lint, host-cli-expressions-lint, host-cli-blueprint-lint, host-cli-portfolio-lint]
// ---
import { homedir } from "node:os";
import { banner } from "./index.ts";

async function main() {
  if (process.argv[2] === "comparator" && process.argv[3] === "lint") {
    const { comparatorLintCommand } = await import("./comparator-lint/command.ts");
    process.exitCode = await comparatorLintCommand(process.argv.slice(4));
  } else if (process.argv[2] === "expressions" && process.argv[3] === "lint") {
    const { expressionsLintCommand } = await import("./expressions-lint/command.ts");
    process.exitCode = await expressionsLintCommand(process.argv.slice(4));
  } else if (process.argv[2] === "blueprint" && process.argv[3] === "lint") {
    const { blueprintLintCommand } = await import("./blueprint-lint/command.ts");
    process.exitCode = await blueprintLintCommand(process.argv.slice(4));
  } else if (process.argv[2] === "portfolio" && process.argv[3] === "lint") {
    const { portfolioLintCommand } = await import("./portfolio-lint/command.ts");
    process.exitCode = await portfolioLintCommand(process.argv.slice(4));
  } else if (process.argv[2] === "usage") {
    const { runUsageCommand } = await import("./usage/index.ts");
    process.exitCode = await runUsageCommand(process.argv.slice(3), {
      stdout: process.stdout,
      stderr: process.stderr,
      env: process.env,
      home: homedir(),
    });
  } else {
    console.log(banner());
  }
}
void main();
