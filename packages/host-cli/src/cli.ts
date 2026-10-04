// ---
// relationships:
//   implements: host-cli-usage
// ---
import { homedir } from "node:os";
import { banner } from "./index.ts";
import { comparatorLintCommand } from "./comparator-lint/command.ts";
import { runUsageCommand } from "./usage/index.ts";

if (process.argv[2] === "comparator" && process.argv[3] === "lint") {
  process.exitCode = await comparatorLintCommand(process.argv.slice(4));
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
