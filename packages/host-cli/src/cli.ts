// ---
// relationships:
//   implements: [host-cli-usage, host-cli-comparator-lint, host-cli-expressions-lint, host-cli-blueprint-lint, host-cli-portfolio-lint]
// ---
import { blueprintLintCommand } from "./blueprint-lint/command.ts";
import { portfolioLintCommand } from "./portfolio-lint/command.ts";
import { homedir } from "node:os";
import { banner } from "./index.ts";
import { comparatorLintCommand } from "./comparator-lint/command.ts";
import { expressionsLintCommand } from "./expressions-lint/command.ts";
import { runUsageCommand } from "./usage/index.ts";

if (process.argv[2] === "comparator" && process.argv[3] === "lint") {
  process.exitCode = await comparatorLintCommand(process.argv.slice(4));
} else if (process.argv[2] === "expressions" && process.argv[3] === "lint") {
  process.exitCode = await expressionsLintCommand(process.argv.slice(4));
} else if (process.argv[2] === "blueprint" && process.argv[3] === "lint") {
  process.exitCode = await blueprintLintCommand(process.argv.slice(4));
} else if (process.argv[2] === "portfolio" && process.argv[3] === "lint") {
  process.exitCode = await portfolioLintCommand(process.argv.slice(4));
} else if (process.argv[2] === "usage") {
  process.exitCode = await runUsageCommand(process.argv.slice(3), {
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
    home: homedir(),
  });
} else {
  console.log(banner());
}
