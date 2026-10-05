// ---
// relationships:
//   implements: [host-cli, host-command-catalog]
// ---
import { homedir } from "node:os";
import { buildCatalog, resolve } from "./catalog/catalog.ts";
import { commandTree } from "./catalog/command-tree.generated.ts";
import { commandHandlers } from "./commands.ts";

async function main() {
  const resolution = resolve(commandTree, process.argv.slice(2));
  if (resolution.kind === "help") {
    process.stdout.write(resolution.text);
    process.exitCode = 0;
  } else if (resolution.kind === "refusal") {
    process.stderr.write(resolution.text);
    process.exitCode = 2;
  } else {
    const command = buildCatalog(commandTree, commandHandlers).find(
      (command) => command.path.join(" ") === resolution.path.join(" "),
    )!;
    process.exitCode = await command.handler(resolution.args, {
      stdout: process.stdout,
      stderr: process.stderr,
      env: process.env,
      home: homedir(),
    });
  }
}
void main();
