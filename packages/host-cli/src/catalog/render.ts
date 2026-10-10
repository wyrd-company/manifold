// ---
// relationships:
//   implements: host-command-catalog
// ---
import type { CommandNode, HelpNode } from "./types.ts";

const fold = (text: string) => text.replace(/\s*\r?\n\s*/g, " ").trim();
const descriptionColumn = 22;
function entry(name: string, description: string): string {
  const prefix = `  ${name}`;
  let line =
    prefix.length >= descriptionColumn
      ? " ".repeat(descriptionColumn)
      : prefix.padEnd(descriptionColumn);
  const lines = prefix.length >= descriptionColumn ? [prefix] : [];
  for (const word of fold(description).split(/\s+/)) {
    if (line.length + word.length + (line.trim().length ? 1 : 0) > 80 && line.trim()) {
      lines.push(line);
      line = " ".repeat(descriptionColumn);
    }
    // The first word follows the padded label without an extra space.
    line += `${line.endsWith(" ") ? "" : " "}${word}`;
  }
  lines.push(line.trimEnd());
  return lines.join("\n");
}
function invocation(node: HelpNode): string {
  return [node.tool, ...node.path].join(" ");
}
function usage(node: HelpNode): string {
  if (node.subcommands) return `Usage:\n  ${invocation(node)} <command> [flags]`;
  const parts = [invocation(node)];
  for (const flag of node.flags.filter((flag) => flag.required))
    parts.push(`${flag.flags[0]}${flag.kind === "option" ? " <value>" : ""}`);
  if (node.flags.some((flag) => !flag.required)) parts.push("[flags]");
  for (const argument of [...node.arguments].sort((a, b) => a.position - b.position)) {
    const name = `<${argument.name}>`;
    parts.push(`${argument.required ? name : `[${name}]`}${argument.greedy ? "..." : ""}`);
  }
  return `Usage:\n  ${parts.join(" ")}`;
}
function commands(node: HelpNode): string {
  function descendants(
    nodes: readonly CommandNode[],
    path: string[],
  ): { name: string; summary: string }[] {
    return nodes.flatMap((child) =>
      child.subcommands
        ? descendants(child.subcommands, [...path, child.name])
        : [{ name: [...path, child.name].join(" "), summary: child.summary }],
    );
  }
  const entries = descendants(node.subcommands!, []).sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  return `Commands:\n${entries.map((command) => entry(command.name, command.summary)).join("\n")}`;
}
export function renderUsage(node: HelpNode): string {
  return (
    [
      usage(node),
      ...(node.subcommands ? [commands(node)] : []),
      `Run '${invocation(node)} --help' for more.`,
    ].join("\n\n") + "\n"
  );
}
export function renderHelp(node: HelpNode): string {
  const sections = [fold(node.summary), usage(node)];
  if (node.subcommands) sections.push(commands(node));
  else if (node.arguments.length)
    sections.push(
      `Arguments:\n${[...node.arguments]
        .sort((a, b) => a.position - b.position)
        .map((arg) => entry(`<${arg.name}>`, arg.description))
        .join("\n")}`,
    );
  const flags = node.flags.map((flag) =>
    entry(
      `${flag.flags.join(", ")}${flag.kind === "option" ? ` <${flag.value!.type}>` : ""}`,
      `${fold(flag.description)}${flag.required ? " Required." : ""}${flag.repeatable ? " Repeatable." : ""}${flag.default === undefined ? "" : ` Default: ${flag.default}.`}`,
    ),
  );
  flags.push(entry(node.help.flags.join(", "), node.help.description));
  sections.push(`Flags:\n${flags.join("\n")}`);
  if (node.subcommands)
    sections.push(
      `Run '${invocation(node)} <command> --help' for the arguments and flags of a command.`,
    );
  else {
    if (node.exitCodes.length)
      sections.push(
        `Exit codes:\n${node.exitCodes.map((code) => entry(String(code.code), code.meaning)).join("\n")}`,
      );
    if (node.examples.length)
      sections.push(`Examples:\n${node.examples.map((example) => `  ${example}`).join("\n")}`);
  }
  return sections.join("\n\n") + "\n";
}
