import { banner } from "./index.ts";
import { comparatorLintCommand } from "./comparator-lint/command.ts";

if (process.argv[2] === "comparator" && process.argv[3] === "lint") {
  process.exitCode = await comparatorLintCommand(process.argv.slice(4));
} else {
  console.log(banner());
}
