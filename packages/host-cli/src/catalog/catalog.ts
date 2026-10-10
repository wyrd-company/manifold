// ---
// relationships:
//   implements: [host-command-catalog, host-cli]
// ---
import type { CommandHandler, CommandTree, HelpNode, HostCommandCatalog } from "./types.ts";
export { renderHelp, renderUsage } from "./render.ts";
import { renderHelp, renderUsage } from "./render.ts";

export function commandNodes(tree: CommandTree): HelpNode[] {
  const root: HelpNode = {
    tool: tree.tool.name,
    path: [],
    name: tree.tool.name,
    summary: tree.tool.summary,
    arguments: [],
    flags: [],
    exitCodes: [],
    examples: [],
    subcommands: tree.commands,
    help: tree.help,
  };
  function descend(node: HelpNode): HelpNode[] {
    return [
      node,
      ...(node.subcommands ?? []).flatMap((child) =>
        descend({ ...child, tool: node.tool, path: [...node.path, child.name], help: tree.help }),
      ),
    ];
  }
  return descend(root);
}
export function buildCatalog(
  tree: CommandTree,
  handlers: Readonly<Record<string, CommandHandler>>,
): HostCommandCatalog {
  return commandNodes(tree)
    .filter((node) => !node.subcommands && node.path.join(" ") !== "help")
    .map((node) => ({
      path: node.path,
      summary: node.summary,
      arguments: node.arguments,
      flags: node.flags,
      handler: handlers[node.path.join(" ")]!,
    }));
}
type Resolution =
  | { kind: "help"; text: string }
  | { kind: "refusal"; text: string }
  | { kind: "run"; path: readonly string[]; args: string[] };

const isFlag = (arg: string) => arg.startsWith("-") && arg.length > 1;

function flagArguments(node: HelpNode, args: readonly string[]): string[] {
  const flags: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!isFlag(arg)) continue;
    const name = arg.split("=", 1)[0]!;
    flags.push(name);
    if (
      !arg.includes("=") &&
      node.flags.some((flag) => flag.kind === "option" && flag.flags.includes(name))
    )
      i++;
  }
  return flags;
}
function refusal(node: HelpNode, message: string): Resolution {
  return { kind: "refusal", text: `${node.tool}: ${message}\n\n${renderUsage(node)}` };
}
function unknownFlag(node: HelpNode, flag: string): Resolution {
  return refusal(
    node,
    `unknown flag '${flag}'${node.path.length ? ` for '${node.path.join(" ")}'` : ""}`,
  );
}
function unknownCommand(node: HelpNode, name: string): Resolution {
  return refusal(node, `unknown command '${[...node.path, name].join(" ")}'`);
}
export function resolve(tree: CommandTree, args: readonly string[]): Resolution {
  const nodes = commandNodes(tree);
  let node = nodes[0]!;
  let consumed = 0;
  function child(parent: HelpNode, name: string): HelpNode | undefined {
    return parent.subcommands?.some((entry) => entry.name === name)
      ? nodes.find((entry) => entry.path.join(" ") === [...parent.path, name].join(" "))
      : undefined;
  }
  while (consumed < args.length) {
    const next = child(node, args[consumed]!);
    if (!next) break;
    node = next;
    consumed++;
  }
  const remaining = args.slice(consumed);
  const flags = flagArguments(node, remaining);
  if (flags.some((flag) => tree.help.flags.includes(flag)))
    return { kind: "help", text: renderHelp(node) };
  if (node.subcommands && !remaining.length) return { kind: "help", text: renderHelp(node) };
  if (node.subcommands && remaining[0] && !isFlag(remaining[0]))
    return unknownCommand(node, remaining[0]);
  const unknown = flags.find((flag) => !node.flags.some((entry) => entry.flags.includes(flag)));
  if (unknown) return unknownFlag(node, unknown);
  if (node.path.join(" ") === "help") {
    let target = nodes[0]!;
    for (const name of remaining) {
      const next = child(target, name);
      if (!next) return unknownCommand(target, name);
      target = next;
    }
    return { kind: "help", text: renderHelp(target) };
  }
  if (node.subcommands) return unknownCommand(node, remaining[0]!);
  return { kind: "run", path: node.path, args: remaining };
}
