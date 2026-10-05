// ---
// relationships:
//   implements: host-command-catalog
// ---
import { isDeepStrictEqual } from "node:util";
import type { Argument, CommandNode, CommandTree, Flag } from "./types.ts";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Expected object");
  return value as Record<string, unknown>;
}
function string(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw Error("Expected nonempty text");
  return value;
}
function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw Error("Expected array");
  return value;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw Error("Expected boolean");
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw Error("Expected integer");
  return value;
}
function argument(value: unknown): Argument {
  const entry = object(value);
  return {
    name: string(entry["name"]),
    description: string(entry["description"]),
    position: number(entry["position"]),
    required: boolean(entry["required"]),
    ...(entry["greedy"] === undefined ? {} : { greedy: boolean(entry["greedy"]) }),
  };
}
function flag(value: unknown): Flag {
  const entry = object(value);
  const flags = array(entry["flags"]).map(string);
  if (!flags.length || flags.some((name) => ["-h", "--help"].includes(name)))
    throw Error("Command flags must be nonempty and may not declare -h or --help");
  const kind = entry["kind"];
  if (kind !== "option" && kind !== "flag") throw Error("Expected option or flag");
  const defaultValue = entry["default"];
  if (
    defaultValue !== undefined &&
    typeof defaultValue !== "string" &&
    typeof defaultValue !== "number" &&
    typeof defaultValue !== "boolean"
  )
    throw Error("Expected scalar default");
  return {
    flags,
    kind,
    description: string(entry["description"]),
    required: boolean(entry["required"]),
    ...(entry["repeatable"] === undefined ? {} : { repeatable: boolean(entry["repeatable"]) }),
    ...(defaultValue === undefined ? {} : { default: defaultValue }),
    ...(kind === "option" ? { value: { type: string(object(entry["value"])["type"]) } } : {}),
  };
}
function command(value: unknown, depth: number): CommandNode {
  const entry = object(value);
  const name = string(entry["name"]);
  if (name === "-h" || name === "--help" || (name === "help" && depth !== 0))
    throw Error("Reserved command name");
  const output = entry["output"] === undefined ? {} : object(entry["output"]);
  return {
    name,
    summary: string(entry["summary"]),
    arguments: array(entry["positional-arguments"] ?? []).map(argument),
    flags: array(entry["options"] ?? []).map(flag),
    exitCodes: array(output["exit-codes"] ?? []).map((value) => {
      const code = object(value);
      return { code: number(code["code"]), meaning: string(code["meaning"]) };
    }),
    examples: array(entry["examples"] ?? []).map(string),
    ...(entry["subcommands"] === undefined
      ? {}
      : {
          subcommands: mergeCommands(
            [],
            array(entry["subcommands"]).map((value) => command(value, depth + 1)),
          ),
        }),
  };
}
function mergeCommands(left: readonly CommandNode[], right: readonly CommandNode[]): CommandNode[] {
  const merged = new Map(left.map((node) => [node.name, node]));
  for (const node of right) {
    const previous = merged.get(node.name);
    if (!previous) merged.set(node.name, node);
    else {
      if (!previous.subcommands || !node.subcommands)
        throw Error(`Duplicate command '${node.name}'`);
      if (previous.summary !== node.summary)
        throw Error(`Group summary differs for '${node.name}'`);
      merged.set(node.name, {
        ...previous,
        subcommands: mergeCommands(previous.subcommands, node.subcommands),
      });
    }
  }
  return [...merged.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// The root asset is passed first; remaining assets are passed in path order.
export function mergeCommandTrees(assets: readonly unknown[]): CommandTree {
  const root = object(assets[0]);
  const rootTool = object(root["tool"]);
  const tool = { name: string(rootTool["name"]), summary: string(rootTool["summary"]) };
  const global = object(array(root["global-options"])[0]);
  const help = {
    flags: array(global["flags"]).map(string),
    description: string(global["description"]),
  };
  let commands: CommandNode[] = [];
  for (const asset of assets) {
    const entry = object(asset);
    if (!isDeepStrictEqual(entry["tool"], rootTool)) throw Error("Asset tool differs from root");
    commands = mergeCommands(
      commands,
      array(entry["commands"]).map((value) => command(value, 0)),
    );
  }
  return { tool, help, commands };
}
